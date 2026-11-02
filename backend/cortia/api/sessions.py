import hashlib
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from ..auth import get_db, current_user
from ..models import Recording, Segment, Baseline, Anomaly, Report
from ..analytics.baseline import summarize, compare
from ..analytics.anomalies import deviation_events
from ..reports.builder import build_report_data
from ..reports.pdf import generate_pdf
from ..reports.docx import generate_docx

router = APIRouter(prefix='/api', tags=['Recordings, baselines and reports'])

def recording(db, sid, user):
    row = db.query(Recording).filter_by(id=sid, user_id=user.id).first()
    if row is None:
        raise HTTPException(404, 'Recording not found')
    return row


def session_data(row):
    return {name:getattr(row,name) for name in ('id','state','started_at','ended_at','end_reason','context','config',
            'sample_count','missing_samples','valid_windows','invalid_windows','features')}


def baseline_data(row):
    return {name:getattr(row,name) for name in ('id','created_at','session_ids','context','config','statistics')}


def baseline_for(db, row):
    candidates = db.query(Baseline).filter_by(user_id=row.user_id).order_by(Baseline.created_at.desc()).all()
    return next((b for b in candidates if b.context == {k:v for k,v in row.context.items() if k != 'notes'} and b.config == row.config), None)


def baseline_comparison(db, row):
    base = baseline_for(db,row)
    if base is None:
        return {'available':False, 'reason':'No matching personalized baseline for this context and device configuration.'}
    return dict(available=True, baseline_id=base.id, included_in_baseline=row.id in base.session_ids,
                deviations=compare(row.features, base.statistics), method='session-level z-scores; exploratory 3-SD threshold')

class RecordingContext(BaseModel):
    eyes: str = Field(pattern='^(open|closed)$')
    task: str = Field(min_length=1,max_length=100)
    montage: str = Field(min_length=1,max_length=100)
    notes: str = Field(default='',max_length=1000)

@router.post('/sessions/start', status_code=201)
def start(data: RecordingContext, request: Request, user=Depends(current_user)):
    try:
        return request.app.state.acquisition.start_recording(user.id, data.model_dump())
    except ValueError as exc:
        raise HTTPException(409, str(exc))

@router.post('/sessions/stop')
def stop(request: Request, user=Depends(current_user), db=Depends(get_db)):
    try:
        result = request.app.state.acquisition.stop_recording(user.id)
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    row = recording(db,result['id'],user)
    comparison = baseline_comparison(db,row)
    for event in deviation_events(comparison):
        db.add(Anomaly(session_id=row.id, **event))
    db.commit()
    return result

@router.get('/sessions')
def sessions(db=Depends(get_db), user=Depends(current_user), limit:int=Query(100,ge=1,le=500), offset:int=Query(0,ge=0)):
    rows = db.query(Recording).filter_by(user_id=user.id).order_by(Recording.started_at.desc()).offset(offset).limit(limit).all()
    return [session_data(r) for r in rows]

@router.get('/sessions/{sid}')
def detail(sid:str, db=Depends(get_db), user=Depends(current_user)):
    row = recording(db,sid,user)
    latest = db.query(Segment).filter_by(session_id=sid).order_by(Segment.start_index.desc()).first()
    return dict(**session_data(row), latest_segment=latest.result if latest else None, baseline=baseline_comparison(db,row))

@router.get('/sessions/{sid}/segments')
def segments(sid:str, db=Depends(get_db), user=Depends(current_user), limit:int=Query(200,ge=1,le=1000), offset:int=Query(0,ge=0)):
    recording(db,sid,user)
    rows = db.query(Segment).filter_by(session_id=sid).order_by(Segment.start_index).offset(offset).limit(limit).all()
    return [dict(id=r.id,start_index=r.start_index,end_index=r.end_index,created_at=r.created_at,result=r.result) for r in rows]

@router.get('/sessions/{sid}/anomalies')
def anomalies(sid:str, db=Depends(get_db), user=Depends(current_user)):
    recording(db,sid,user)
    return [dict(id=r.id, category=r.category, details=r.details,created_at=r.created_at) for r in db.query(Anomaly).filter_by(session_id=sid).limit(1000).all()]

@router.get('/sessions/{sid}/raw')
def raw(sid:str, request:Request, db=Depends(get_db), user=Depends(current_user)):
    row = recording(db,sid,user)
    if row.state == 'recording':
        raise HTTPException(409, 'Stop recording before export')
    path = request.app.state.settings.data_dir/row.raw_path
    if not path.is_file():
        raise HTTPException(404,'Raw recording file unavailable')
    return FileResponse(path, media_type='text/csv', filename=f'cortia-{sid}-raw.csv')

@router.get('/sessions/{sid}/report')
def report(
    sid: str,
    request: Request,
    format: str = Query('json', pattern='^(json|pdf|docx)$'),
    db=Depends(get_db),
    user=Depends(current_user),
):
    row = recording(db, sid, user)

    # 1. Backward-compatible JSON export
    if format == 'json':
        data = dict(
            product='CORTIA',
            category='measured and calculated research data',
            session=session_data(row),
            baseline=baseline_comparison(db, row),
            limitations='Research support only. No diagnosis. Signal quality heuristics are not clinically validated.',
        )
        body = json.dumps(data, indent=2, allow_nan=False)
        db.add(Report(session_id=sid, format='json', digest=hashlib.sha256(body.encode()).hexdigest()))
        db.commit()
        return Response(
            body,
            media_type='application/json',
            headers={'Content-Disposition': f'attachment; filename="cortia-{sid}.json"'},
        )

    # 2. Multimodal Clinical Research Report Data
    report_data = build_report_data(db, user, request.app.state.settings, session_id=sid)

    # 3. PDF Format
    if format == 'pdf':
        pdf_bytes = generate_pdf(report_data)
        digest = hashlib.sha256(pdf_bytes).hexdigest()
        db.add(Report(session_id=sid, format='pdf', digest=digest))
        db.commit()
        return Response(
            pdf_bytes,
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="cortia-{sid}-brain-health-report.pdf"',
                'Cache-Control': 'no-store',
            },
        )

    # 4. DOCX Format
    if format == 'docx':
        docx_bytes = generate_docx(report_data)
        digest = hashlib.sha256(docx_bytes).hexdigest()
        db.add(Report(session_id=sid, format='docx', digest=digest))
        db.commit()
        return Response(
            docx_bytes,
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            headers={
                'Content-Disposition': f'attachment; filename="cortia-{sid}-brain-health-report.docx"',
                'Cache-Control': 'no-store',
            },
        )

    raise HTTPException(400, f'Unsupported report format: {format}')


@router.get('/reports/brain-health')
def brain_health_report(
    request: Request,
    format: str = Query('pdf', pattern='^(json|pdf|docx)$'),
    session_id: Optional[str] = Query(None),
    db=Depends(get_db),
    user=Depends(current_user),
):
    """Generate overall Brain Health Monitoring Report for the user's latest session or specified session."""
    try:
        report_data = build_report_data(db, user, request.app.state.settings, session_id=session_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))

    focal_sid = report_data.get('eeg_analysis', {}).get('session_id')

    if format == 'json':
        # Serialize report data with clean json representation
        clean_json_data = {k: v for k, v in report_data.items() if k not in ('eeg_analysis', 'historical_analysis')}
        clean_json_data['eeg_analysis'] = {
            k: v for k, v in report_data['eeg_analysis'].items() if k != 'chart_png_bytes'
        }
        clean_json_data['mri_analysis'] = {
            k: v for k, v in report_data['mri_analysis'].items() if k not in ('gradcam_png_bytes', 'raw_scan_png_bytes')
        }
        clean_json_data['historical_analysis'] = {
            k: v for k, v in report_data['historical_analysis'].items() if k != 'trend_chart_bytes'
        }
        body = json.dumps(clean_json_data, indent=2, default=str)
        if focal_sid:
            db.add(Report(session_id=focal_sid, format='json', digest=hashlib.sha256(body.encode()).hexdigest()))
            db.commit()
        return Response(
            body,
            media_type='application/json',
            headers={'Content-Disposition': f'attachment; filename="cortia-{report_data["report_id"]}.json"'},
        )

    if format == 'pdf':
        pdf_bytes = generate_pdf(report_data)
        if focal_sid:
            db.add(Report(session_id=focal_sid, format='pdf', digest=hashlib.sha256(pdf_bytes).hexdigest()))
            db.commit()
        return Response(
            pdf_bytes,
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="cortia-{report_data["report_id"]}.pdf"',
                'Cache-Control': 'no-store',
            },
        )

    if format == 'docx':
        docx_bytes = generate_docx(report_data)
        if focal_sid:
            db.add(Report(session_id=focal_sid, format='docx', digest=hashlib.sha256(docx_bytes).hexdigest()))
            db.commit()
        return Response(
            docx_bytes,
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            headers={
                'Content-Disposition': f'attachment; filename="cortia-{report_data["report_id"]}.docx"',
                'Cache-Control': 'no-store',
            },
        )

    raise HTTPException(400, f'Unsupported report format: {format}')

class BaselineRequest(BaseModel):
    session_ids: list[str] = Field(min_length=3, max_length=200)

@router.get('/baselines')
def baselines(db=Depends(get_db),user=Depends(current_user)):
    return [baseline_data(r) for r in db.query(Baseline).filter_by(user_id=user.id).order_by(Baseline.created_at.desc()).limit(100).all()]

@router.post('/baselines',status_code=201)
def create_baseline(data:BaselineRequest,db=Depends(get_db),user=Depends(current_user)):
    if len(set(data.session_ids)) != len(data.session_ids):
        raise HTTPException(422,'Select distinct sessions')
    rows = [recording(db,sid,user) for sid in data.session_ids]
    if any(r.state != 'completed' or r.valid_windows < 3 for r in rows):
        raise HTTPException(422,'Each session must be completed and contain at least three usable eight-second windows')
    # Free-form notes are intentionally not part of recording comparability.
    context = {k:v for k,v in rows[0].context.items() if k != 'notes'}
    if any({k:v for k,v in r.context.items() if k != 'notes'} != context or r.config != rows[0].config for r in rows):
        raise HTTPException(422,'Sessions must share eyes, task, montage and acquisition configuration')
    statistics = summarize([dict(id=r.id,features=r.features) for r in rows])
    baseline = Baseline(user_id=user.id,session_ids=data.session_ids,context=context,config=rows[0].config,statistics=statistics)
    db.add(baseline)
    db.commit()
    return baseline_data(baseline)
