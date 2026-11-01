from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from ..auth import current_user, get_db
from ..models import Explanation, AIConversation, AIMessage
from ..services.explanations import explain
from ..services.gemini import ask_gemini, resolve_api_key, resolve_model_name
from ..services.medical_tools import (
    get_patient_mri_context,
    get_patient_eeg_context,
    assess_stress_level,
    assess_anxiety_level,
    check_neurological_red_flags,
    calculate_theta_beta_ratio,
    get_crisis_support_info,
)
from ..db import now
from .sessions import recording, session_data, baseline_comparison

router = APIRouter(prefix='/api', tags=['Evidence explanations & CORTIA AI Assistant'])


# ==========================================
# 1. Existing Session Explanations
# ==========================================

class InsightRequest(BaseModel):
    use_external_ai: bool = False
    consent_to_send_metrics: bool = False


@router.post('/sessions/{sid}/explanations')
def generate(sid: str, data: InsightRequest, request: Request, user=Depends(current_user), db=Depends(get_db)):
    row = recording(db, sid, user)
    if data.use_external_ai and not data.consent_to_send_metrics:
        raise HTTPException(422, 'Explicit consent required to send curated metrics to configured external AI')
    try:
        result = explain(session_data(row), baseline_comparison(db, row), request.app.state.settings, data.use_external_ai)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    except Exception:
        raise HTTPException(502, 'External explanation service unavailable or returned invalid evidence selections')
    item = Explanation(user_id=user.id, session_id=sid, evidence_digest=result['evidence_digest'], result=result)
    db.add(item)
    db.commit()
    return dict(id=item.id, created_at=item.created_at, **result)


@router.get('/sessions/{sid}/explanations')
def history(sid: str, user=Depends(current_user), db=Depends(get_db)):
    recording(db, sid, user)
    return [
        dict(id=r.id, created_at=r.created_at, **r.result)
        for r in db.query(Explanation)
        .filter_by(user_id=user.id, session_id=sid)
        .order_by(Explanation.created_at.desc())
        .limit(100)
        .all()
    ]


# ==========================================
# 2. Gemini Flash AI Assistant Endpoints
# ==========================================

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


@router.get('/ai/config')
def get_ai_config(request: Request, user=Depends(current_user)):
    settings = request.app.state.settings
    active_model = resolve_model_name(None, settings.ai_model)
    has_key = bool(resolve_api_key(None, settings.ai_key))
    return {
        "provider": "Gemini 3.8 Flash High",
        "model": active_model,
        "configured": has_key,
        "endpoint": getattr(settings, 'ai_endpoint', 'http://127.0.0.1:5000/v1'),
        "supported_models": [
            "antigravity/gemini-3.8-flash-high",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
        ],
    }


@router.post('/ai/chat')
def chat_with_assistant(
    data: ChatRequest,
    request: Request,
    user=Depends(current_user),
    db=Depends(get_db)
):
    settings = request.app.state.settings

    # Only enrich context with patient records if the query actually pertains to them
    patient_context = dict(data.context or {})
    msg_lower = data.message.lower().strip()
    wants_mri = any(w in msg_lower for w in [
        "scan", "mri", "tumor", "tumour", "record", "result", "my report",
        "my test", "my brain", "what did my", "pituitary", "glioma", "meningioma",
        "gradcam", "grad-cam", "history", "check my", "review my", "classification"
    ])
    wants_eeg = any(w in msg_lower for w in [
        "eeg", "wave", "brainwave", "alpha", "beta", "theta", "delta", "tbr",
        "recording", "session", "biopotential"
    ])

    if user and wants_mri:
        mri_ctx = get_patient_mri_context(db, user.id)
        if mri_ctx.get("has_mri"):
            patient_context["recent_mri_record"] = mri_ctx
    if user and wants_eeg:
        eeg_ctx = get_patient_eeg_context(db, user.id)
        if eeg_ctx.get("has_eeg"):
            patient_context["recent_eeg_record"] = eeg_ctx

    # Resolve or create conversation
    conv = None
    if data.conversation_id:
        conv = db.query(AIConversation).filter_by(id=data.conversation_id, user_id=user.id).first()

    if not conv:
        conv = AIConversation(
            user_id=user.id,
            title=data.message[:60].strip(),
            provider="gemini",
        )
        db.add(conv)
        db.commit()

    # Load recent conversation history turns
    recent_msgs = (
        db.query(AIMessage)
        .filter_by(conversation_id=conv.id)
        .order_by(AIMessage.created_at.asc())
        .limit(10)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in recent_msgs]

    # Save user message
    user_msg = AIMessage(
        conversation_id=conv.id,
        role="user",
        content=data.message,
    )
    db.add(user_msg)
    db.commit()

    # Ask Gemini Assistant
    result = ask_gemini(
        message=data.message,
        history=history,
        context=patient_context,
        api_key=data.api_key,
        model=data.model,
        settings=settings,
    )

    # Save assistant message
    asst_msg = AIMessage(
        conversation_id=conv.id,
        role="assistant",
        content=result["reply"],
        citations=result.get("citations", []),
    )
    conv.updated_at = now()
    db.add(asst_msg)
    db.commit()

    return {
        "conversation_id": conv.id,
        "reply": result["reply"],
        "provider": result["provider"],
        "model": result.get("model", "antigravity/gemini-3.8-flash-high"),
        "citations": result.get("citations", []),
        "authenticated": result.get("authenticated", False),
        "red_flags": result.get("red_flags"),
        "created_at": asst_msg.created_at,
    }


@router.get('/ai/conversations')
def list_conversations(user=Depends(current_user), db=Depends(get_db)):
    rows = (
        db.query(AIConversation)
        .filter_by(user_id=user.id)
        .order_by(AIConversation.updated_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "provider": c.provider,
        }
        for c in rows
    ]


@router.get('/ai/conversations/{cid}/messages')
def get_conversation_messages(cid: str, user=Depends(current_user), db=Depends(get_db)):
    conv = db.query(AIConversation).filter_by(id=cid, user_id=user.id).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    messages = (
        db.query(AIMessage)
        .filter_by(conversation_id=cid)
        .order_by(AIMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at,
            "citations": m.citations or [],
        }
        for m in messages
    ]


@router.delete('/ai/conversations/{cid}')
def delete_conversation(cid: str, user=Depends(current_user), db=Depends(get_db)):
    conv = db.query(AIConversation).filter_by(id=cid, user_id=user.id).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    db.query(AIMessage).filter_by(conversation_id=cid).delete()
    db.delete(conv)
    db.commit()
    return {"status": "deleted", "id": cid}


# ==========================================
# 3. Clinical & Mental Health Tools Endpoints
# ==========================================

class StressAssessmentRequest(BaseModel):
    score: int = Field(..., ge=0, le=40)
    max_score: int = Field(default=16, ge=4, le=40)


class AnxietyAssessmentRequest(BaseModel):
    score: int = Field(..., ge=0, le=21)


class RedFlagCheckRequest(BaseModel):
    symptoms: str = Field(..., min_length=1, max_length=1000)


class TBRCalculationRequest(BaseModel):
    theta_pct: float = Field(..., ge=0.0, le=100.0)
    beta_pct: float = Field(..., gt=0.0, le=100.0)


@router.get('/ai/tools')
def list_medical_tools():
    return {
        "tools": [
            {
                "id": "stress_assessment",
                "name": "Perceived Stress Scale (PSS) Evaluator",
                "description": "Calculates stress severity, HPA-axis activation impact, and evidence-based reduction protocols.",
            },
            {
                "id": "anxiety_assessment",
                "name": "GAD-7 Anxiety Scale Screener",
                "description": "Evaluates generalized anxiety severity and clinical referral thresholds.",
            },
            {
                "id": "neurological_red_flags",
                "name": "Acute Neurological Red Flag Checker",
                "description": "Screens for stroke (BE-FAST), thunderclap headache, intracranial pressure, or meningeal signs.",
            },
            {
                "id": "theta_beta_ratio",
                "name": "Theta/Beta Ratio (TBR) Cognitive Calculator",
                "description": "Computes cortical arousal ratio and cognitive alertness balance from EEG relative powers.",
            },
            {
                "id": "crisis_resources",
                "name": "24/7 Mental Health Crisis Contacts",
                "description": "Provides instant hotline access for the US, UK, India, and international lifelines.",
            },
            {
                "id": "eeg_plain_language",
                "name": "Plain-Language EEG Evidence Explainer",
                "description": "Translates recorded brainwaves, frequency band powers, and signal quality into simple, everyday human language.",
            },
        ]
    }


class EEGExplanationToolRequest(BaseModel):
    session_id: Optional[str] = None


@router.post('/ai/tools/stress')
def run_stress_assessment(data: StressAssessmentRequest):
    return assess_stress_level(data.score, data.max_score)


@router.post('/ai/tools/anxiety')
def run_anxiety_assessment(data: AnxietyAssessmentRequest):
    return assess_anxiety_level(data.score)


@router.post('/ai/tools/red-flags')
def run_red_flag_check(data: RedFlagCheckRequest):
    return check_neurological_red_flags(data.symptoms)


@router.post('/ai/tools/tbr')
def run_tbr_calculation(data: TBRCalculationRequest):
    return calculate_theta_beta_ratio(data.theta_pct, data.beta_pct)


@router.get('/ai/tools/crisis')
def get_crisis_resources():
    return get_crisis_support_info()


@router.post('/ai/tools/explain-eeg')
def run_eeg_plain_language_tool(
    data: Optional[EEGExplanationToolRequest] = None,
    user=Depends(current_user),
    db=Depends(get_db),
):
    from ..services.explanations import human_friendly_explanation
    from ..models import Recording
    sid = data.session_id if data else None
    if sid:
        row = recording(db, sid, user)
    else:
        row = (
            db.query(Recording)
            .filter_by(user_id=user.id)
            .order_by(Recording.started_at.desc())
            .first()
        )
        if not row:
            raise HTTPException(404, "No EEG recording sessions found for this user.")

    base_comp = baseline_comparison(db, row)
    return human_friendly_explanation(session_data(row), base_comp)
