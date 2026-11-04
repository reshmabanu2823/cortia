"""Data collection and report synthesis logic for CORTIA Brain Health Monitoring Reports."""
import base64
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from ..models import User, Recording, Baseline, MRIUpload, MRIPrediction
from ..analytics.baseline import compare
from .charts import render_band_power_chart, render_history_trend_chart
from .plain_eeg import explain_recording
from ..services.eeg_states import signal_state

CLASS_DISPLAY_NAMES = {
    "glioma_tumor": "Glioma",
    "meningioma_tumor": "Meningioma",
    "no_tumor": "No Tumor Detected",
    "pituitary_tumor": "Pituitary Tumor",
}


def session_data(row):
    return {
        name: getattr(row, name)
        for name in (
            "id",
            "state",
            "started_at",
            "ended_at",
            "end_reason",
            "context",
            "config",
            "sample_count",
            "missing_samples",
            "valid_windows",
            "invalid_windows",
            "features",
        )
    }


def baseline_for(db: Session, row: Recording):
    candidates = db.query(Baseline).filter_by(user_id=row.user_id).order_by(Baseline.created_at.desc()).all()
    return next(
        (
            b
            for b in candidates
            if b.context == {k: v for k, v in row.context.items() if k != "notes"} and b.config == row.config
        ),
        None,
    )


def baseline_comparison(db: Session, row: Recording):
    base = baseline_for(db, row)
    if base is None:
        return {"available": False, "reason": "No matching personalized baseline for this context and device configuration."}
    return dict(
        available=True,
        baseline_id=base.id,
        included_in_baseline=row.id in base.session_ids,
        deviations=compare(row.features, base.statistics),
        method="session-level z-scores; exploratory 3-SD threshold",
    )


def _format_iso_datetime(dt_str: Optional[str]) -> str:
    if not dt_str:
        return "Unknown"
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%B %d, %Y • %H:%M UTC")
    except Exception:
        return dt_str[:19].replace("T", " ") + " UTC"


def build_report_data(
    db: Session,
    user: User,
    settings: Any,
    session_id: Optional[str] = None,
    mri_id: Optional[str] = None,
    report_type: str = "eeg",
) -> Dict[str, Any]:
    """Collects all real database records and builds a structured, un-fabricated report dictionary."""

    # 1. Focal Session Selection
    if report_type == "mri":
        focal_session = None
    elif session_id:
        focal_session = db.query(Recording).filter_by(id=session_id, user_id=user.id).first()
        if not focal_session:
            raise ValueError(f"Recording session '{session_id}' not found for current user.")
    else:
        focal_session = (
            db.query(Recording)
            .filter_by(user_id=user.id)
            .order_by(Recording.started_at.desc())
            .first()
        )

    # 2. Historical User Sessions
    all_user_sessions = [] if report_type == "mri" else [focal_session] if session_id and focal_session else (
        db.query(Recording)
        .filter_by(user_id=user.id)
        .order_by(Recording.started_at.asc())
        .all()
    )

    # 3. Latest Cranial MRI Record & Prediction
    mri_query = (
        db.query(MRIUpload)
        .filter_by(user_id=user.id)
    )
    if mri_id:
        mri_query = mri_query.filter_by(id=mri_id)
    mri_upload = mri_query.order_by(MRIUpload.created_at.desc()).first() if report_type == "mri" else None
    if mri_id and mri_upload is None:
        raise ValueError('MRI upload not found')

    mri_data: Dict[str, Any] = {
        "available": False,
        "upload_id": None,
        "filename": None,
        "created_at": None,
        "label": None,
        "display_label": None,
        "probabilities": {},
        "top_confidence_pct": None,
        "gradcam_available": False,
        "gradcam_png_bytes": None,
        "raw_scan_png_bytes": None,
        "model_sha256": None,
        "preprocessing": None,
        "limitations": [
            "No MRI scan uploaded for this account.",
            "MRI classifier results require high-resolution cranial MR images with preserved contrast.",
        ],
    }

    if mri_upload:
        prediction_record = db.get(MRIPrediction, mri_upload.id)
        raw_scan_path = Path(settings.data_dir) / mri_upload.private_path
        raw_bytes = raw_scan_path.read_bytes() if raw_scan_path.is_file() else None

        gradcam_bytes = None
        gradcam_available = False
        pred_dict = prediction_record.result if prediction_record else {}

        if pred_dict:
            label = pred_dict.get("label")
            probs = pred_dict.get("probabilities", {})
            explainability = pred_dict.get("explainability", {})

            if explainability.get("available") and explainability.get("overlay"):
                overlay_data = explainability["overlay"]
                if overlay_data.startswith("data:image/png;base64,"):
                    b64_content = overlay_data.split(",", 1)[1]
                    try:
                        gradcam_bytes = base64.b64decode(b64_content)
                        gradcam_available = True
                    except Exception:
                        gradcam_bytes = None

            top_prob = probs.get(label, 0.0) if label else 0.0

            mri_data = {
                "available": True,
                "upload_id": mri_upload.id,
                "filename": mri_upload.filename,
                "created_at": _format_iso_datetime(mri_upload.created_at),
                "sha256": mri_upload.sha256,
                "label": label,
                "display_label": CLASS_DISPLAY_NAMES.get(label, label or "Unknown"),
                "probabilities": {
                    CLASS_DISPLAY_NAMES.get(k, k): round(v * 100, 2)
                    for k, v in sorted(probs.items(), key=lambda x: x[1], reverse=True)
                },
                "top_confidence_pct": round(top_prob * 100, 1),
                "gradcam_available": gradcam_available,
                "gradcam_png_bytes": gradcam_bytes,
                "raw_scan_png_bytes": raw_bytes,
                "model_sha256": pred_dict.get("model_sha256"),
                "preprocessing": pred_dict.get("preprocessing"),
                "limitations": pred_dict.get("limitations", [
                    "Raster verification cannot confirm slice modality or patient identity.",
                    "Research support classification only. Not a clinical radiological diagnosis.",
                ]),
            }

    # 4. Focal EEG Session Data
    now_utc = datetime.now(timezone.utc)
    report_id = f"REP-{now_utc.strftime('%Y%m%d')}-{hashlib.sha256(f'{user.id}:{now_utc.isoformat()}'.encode()).hexdigest()[:8].upper()}"

    if focal_session:
        session_dict = session_data(focal_session)
        features = focal_session.features or {}
        comparison = baseline_comparison(db, focal_session)

        # Relative band power
        rel_delta = float(features.get("relative_delta", 0.0))
        rel_theta = float(features.get("relative_theta", 0.0))
        rel_alpha = float(features.get("relative_alpha", 0.0))
        rel_beta = float(features.get("relative_beta", 0.0))
        rel_gamma = float(features.get("relative_gamma", 0.0))

        # Ratios
        theta_beta = features.get('theta_beta')
        alpha_theta = features.get('alpha_theta')

        # Signal quality
        total_w = focal_session.valid_windows + focal_session.invalid_windows
        usable_pct = round((focal_session.valid_windows / total_w) * 100, 1) if total_w > 0 else 0.0
        missing_rate_pct = (
            round((focal_session.missing_samples / max(1, focal_session.sample_count)) * 100, 2)
            if focal_session.sample_count > 0
            else 0.0
        )

        quality_verdict = (
            "Most sections were usable"
            if usable_pct >= 80 and missing_rate_pct < 0.5
            else "Some sections had signal problems"
            if usable_pct >= 50
            else "Many sections had signal problems"
        )

        bands_for_chart = {
            "delta": rel_delta,
            "theta": rel_theta,
            "alpha": rel_alpha,
            "beta": rel_beta,
        }
        band_chart_bytes = render_band_power_chart(bands_for_chart)

        eeg_data = {
            "available": True,
            "session_id": focal_session.id,
            "state": focal_session.state,
            "started_at": _format_iso_datetime(focal_session.started_at),
            "ended_at": _format_iso_datetime(focal_session.ended_at),
            "context": focal_session.context,
            "config": focal_session.config,
            "sample_count": focal_session.sample_count,
            "missing_samples": focal_session.missing_samples,
            "missing_rate_pct": missing_rate_pct,
            "valid_windows": focal_session.valid_windows,
            "invalid_windows": focal_session.invalid_windows,
            "usable_pct": usable_pct,
            "quality_verdict": quality_verdict,
            "features": features,
            "bands": {
                "Delta": {"rel": rel_delta, "range": "0.5 - 4.0 Hz", "role": "The slowest waves measured in this recording"},
                "Theta": {"rel": rel_theta, "range": "4.0 - 8.0 Hz", "role": "Slow waves, faster than delta"},
                "Alpha": {"rel": rel_alpha, "range": "8.0 - 13.0 Hz", "role": "Waves between the slower and faster groups"},
                "Beta": {"rel": rel_beta, "range": "13.0 - 29.5 Hz", "role": "The fastest waves measured by this analysis"},
            },
            "ratios": {
                "Theta / Beta Ratio (TBR)": theta_beta,
                "Alpha / Theta Ratio": alpha_theta,
            },
            "baseline_comparison": comparison,
            "chart_png_bytes": band_chart_bytes,
        }
    else:
        eeg_data = {
            "available": False,
            "session_id": None,
            "state": "no_recordings",
            "quality_verdict": "No Recorded Data",
            "features": {},
            "bands": {},
            "ratios": {},
            "baseline_comparison": {"available": False, "reason": "No recordings captured yet."},
            "chart_png_bytes": None,
        }

    # 5. Historical Analysis
    history_sessions_dicts = [session_data(s) for s in all_user_sessions if s.valid_windows > 0]
    trend_chart_bytes = (
        render_history_trend_chart(history_sessions_dicts)
        if len(history_sessions_dicts) >= 2
        else None
    )

    history_summary = []
    for s in all_user_sessions[-8:]:  # Up to 8 recent sessions
        history_summary.append({
            "id": s.id,
            "date": _format_iso_datetime(s.started_at)[:12],
            "task": s.context.get("task", "Rest"),
            "eyes": s.context.get("eyes", "N/A"),
            "valid_windows": s.valid_windows,
            "alpha": round(float(s.features.get("relative_alpha", 0.0)) * 100, 1) if s.features else 0.0,
            "beta": round(float(s.features.get("relative_beta", 0.0)) * 100, 1) if s.features else 0.0,
            "theta": round(float(s.features.get("relative_theta", 0.0)) * 100, 1) if s.features else 0.0,
        })

    # 6. Executive Summary Synthesis (Strictly Data-Grounded)
    key_observations = []
    if eeg_data["available"]:
        dominant_band = max(
            eeg_data["bands"].items(),
            key=lambda item: item[1]["rel"],
        )[0]
        dominant_pct = round(eeg_data["bands"][dominant_band]["rel"] * 100, 1)
        key_observations.append(
            f"Focal EEG acquisition recorded {eeg_data['valid_windows']} valid 8-second windows ({eeg_data['usable_pct']}% usable). "
            f"Signal quality categorized as '{eeg_data['quality_verdict']}'."
        )
        key_observations.append(
            f"Spectral profile displays primary power concentration in the {dominant_band} band ({dominant_pct}% relative power)."
        )
        if eeg_data["ratios"]["Theta / Beta Ratio (TBR)"] is not None:
            key_observations.append(
                f"Calculated Theta/Beta Ratio (TBR) is {eeg_data['ratios']['Theta / Beta Ratio (TBR)']:.2f}."
            )
        if eeg_data["baseline_comparison"]["available"]:
            key_observations.append(
                "Personal baseline comparison available. Measured deviations reflect within-person statistical z-scores."
            )
        else:
            key_observations.append(
                f"Personal baseline comparison: {eeg_data['baseline_comparison'].get('reason', 'Not established')}."
            )
    else:
        key_observations.append("No EEG recording sessions available for this user.")

    if mri_data["available"]:
        key_observations.append(
            f"Cranial MRI scan '{mri_data['filename']}' analyzed using verified 4-class TFLite model. "
            f"Model prediction: '{mri_data['display_label']}' ({mri_data['top_confidence_pct']}% model confidence)."
        )
        if mri_data["gradcam_available"]:
            key_observations.append(
                "Grad-CAM model-attention saliency visualization generated and embedded below."
            )
    else:
        key_observations.append(
            "Cranial MRI scan: Not uploaded or analyzed for this subject profile."
        )

    # 7. Interpretations & Technical Metrics
    interpretations = [
        {
            "metric": "Delta Power (0.5 – 4.0 Hz)",
            "measurement": f"{eeg_data['bands']['Delta']['rel']*100:.1f}%" if eeg_data['available'] else "N/A",
            "interpretation": (
                "Typically dominant during slow-wave non-REM sleep. In waking recordings, elevated delta frequently reflects "
                "physiological ocular artifacts (blinks, saccades) or lowered general vigilance."
            ),
        },
        {
            "metric": "Theta Power (4.0 – 8.0 Hz)",
            "measurement": f"{eeg_data['bands']['Theta']['rel']*100:.1f}%" if eeg_data['available'] else "N/A",
            "interpretation": (
                "Rhythms linked to hypnagogic drowsiness, inward mental reflection, deep meditation, or memory encoding. "
                "Exploratory metrics evaluate theta in ratio with higher-frequency bands."
            ),
        },
        {
            "metric": "Alpha Power (8.0 – 13.0 Hz)",
            "measurement": f"{eeg_data['bands']['Alpha']['rel']*100:.1f}%" if eeg_data['available'] else "N/A",
            "interpretation": (
                "The classic posterior resting rhythm. Classically prominent during relaxed, eyes-closed wakefulness, "
                "attenuating significantly upon visual engagement or cognitive workload."
            ),
        },
        {
            "metric": "Beta Power (13.0 – 30.0 Hz)",
            "measurement": f"{eeg_data['bands']['Beta']['rel']*100:.1f}%" if eeg_data['available'] else "N/A",
            "interpretation": (
                "Associated with active cortical processing, focused attention, cognitive problem solving, and motor readiness. "
                "Excessive broadband beta may indicate muscle tension or physical artifact."
            ),
        },
        {
            "metric": "Theta / Beta Ratio (TBR)",
            "measurement": f"{eeg_data['ratios']['Theta / Beta Ratio (TBR)']:.2f}" if eeg_data.get('ratios', {}).get('Theta / Beta Ratio (TBR)') is not None else "N/A",
            "interpretation": (
                "Investigated in computational neuroscience as an exploratory index of attentional state balance. "
                "TBR is influenced by electrode placement, montage, and filtering; it is not a clinical diagnosis."
            ),
        },
        {
            "metric": "Grad-CAM Saliency",
            "measurement": "Gradient-weighted Class Activation Map" if mri_data["gradcam_available"] else "Unavailable",
            "interpretation": (
                "Highlights spatial pixel clusters that yielded strongest positive gradient activations toward the classifier's "
                "output label. Grad-CAM demonstrates feature relevance, not pathological tumor segmentation or margin boundaries."
            ),
        },
    ]

    if report_type == "eeg":
        key_observations = explain_recording(focal_session, eeg_data)
        interpretations = [dict(metric=name, measurement=f'{band["rel"] * 100:.1f}%', interpretation=band['role']) for name, band in eeg_data['bands'].items()]
    else:
        key_observations = [text for text in key_observations if any(term in text for term in ("MRI", "Grad-CAM", "Cranial"))]
        interpretations = [item for item in interpretations if any(term in item["metric"] for term in ("MRI", "Grad-CAM"))]

    return {
        "report_type": report_type,
        "signal_state": signal_state(session_data(focal_session)) if report_type == 'eeg' and focal_session else None,
        "report_title": "EEG Signal Analysis Report" if report_type == "eeg" else "MRI Analysis Report",
        "report_subtitle": "Your recording explained in simple words" if report_type == "eeg" else "Selected scan classification and model attention analysis",
        "report_id": report_id,
        "generation_timestamp": _format_iso_datetime(now_utc.isoformat()),
        "user": {
            "id": user.id,
            "username": user.username,
        },
        "executive_summary": {
            "key_observations": key_observations,
            "data_availability": {
                "eeg_available": eeg_data["available"],
                "mri_available": mri_data["available"],
                "baseline_available": eeg_data.get("baseline_comparison", {}).get("available", False),
                "total_sessions": len(all_user_sessions),
            },
        },
        "eeg_analysis": eeg_data,
        "mri_analysis": mri_data,
        "historical_analysis": {
            "total_sessions": len(all_user_sessions),
            "sessions_summary": history_summary,
            "trend_chart_bytes": trend_chart_bytes,
        },
        "interpretations": interpretations,
        "disclaimer": (
            "CORTIA is an exploratory brain health research and neurotechnology monitoring workstation. "
            "All analysis results "
            "are provided exclusively for scientific research, self-monitoring, and educational purposes. "
            "CORTIA is NOT a medical device, is not cleared by the FDA or CE regulatory bodies, and does NOT "
            "provide medical diagnoses, treatment decisions, or clinical prognostic determinations. "
            "Always consult a board-certified neurologist or licensed healthcare provider for clinical medical evaluations."
        ),
    }
