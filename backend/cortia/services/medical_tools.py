"""Comprehensive Clinical, Neurological, and Mental Health Tools for CORTIA AI.

Provides authorized, read-only patient data retrieval, validated psychometric
screeners (PSS, GAD, PHQ), neurological red flag symptom checkers, and
cognitive/brainwave calculators.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)


# ==========================================
# 1. Patient Data Retrieval Tools
# ==========================================

def get_patient_mri_context(db: Session, user_id: str) -> Dict[str, Any]:
    """Retrieve the patient's most recent MRI classification and Grad-CAM results."""
    from ..models import MRIUpload, MRIPrediction

    row = (
        db.query(MRIUpload, MRIPrediction)
        .join(MRIPrediction, MRIUpload.id == MRIPrediction.upload_id)
        .filter(MRIUpload.user_id == user_id)
        .order_by(MRIUpload.created_at.desc())
        .first()
    )
    if not row:
        return {
            "has_mri": False,
            "message": "No MRI scans uploaded yet for this user.",
        }

    upload, pred = row
    res = pred.result or {}
    return {
        "has_mri": True,
        "scan_id": upload.id,
        "filename": upload.filename,
        "created_at": upload.created_at,
        "prediction": res.get("prediction", "Unknown"),
        "confidence_pct": round(float(res.get("confidence", 0.0)) * 100, 2),
        "probabilities": {
            k: round(float(v) * 100, 2)
            for k, v in res.get("probabilities", {}).items()
        },
        "gradcam_available": bool(res.get("gradcam_available")),
        "gradcam_description": res.get(
            "gradcam_description",
            "Model visual attention saliency map (not histological lesion margins)."
        ),
    }


def get_patient_eeg_context(db: Session, user_id: str) -> Dict[str, Any]:
    """Retrieve the patient's latest EEG recording and spectral band metrics."""
    from ..models import Recording

    row = (
        db.query(Recording)
        .filter(Recording.user_id == user_id)
        .order_by(Recording.started_at.desc())
        .first()
    )
    if not row:
        return {
            "has_eeg": False,
            "message": "No EEG recording sessions found for this user.",
        }

    features = row.features or {}
    bands = {
        k.removeprefix("relative_"): round(float(v) * 100, 2)
        for k, v in features.items()
        if k.startswith("relative_")
    }

    dominant_band = max(bands, key=bands.get) if bands else "Unknown"

    return {
        "has_eeg": True,
        "session_id": row.id,
        "started_at": row.started_at,
        "state": row.state,
        "sample_count": row.sample_count,
        "valid_windows": row.valid_windows,
        "invalid_windows": row.invalid_windows,
        "missing_samples": row.missing_samples,
        "dominant_band": dominant_band,
        "relative_band_powers_pct": bands,
        "hardware_boundary": (
            "Single-channel frontal biopotential recording. Cannot replace 10-20 clinical montage "
            "or diagnose clinical sleep stages / hemispheric asymmetry."
        ),
    }


# ==========================================
# 2. Mental Health & Stress Screeners
# ==========================================

def assess_stress_level(score: int, max_score: int = 16) -> Dict[str, Any]:
    """Evaluate Perceived Stress Scale (PSS-4 / PSS-10) score and physiological impact.

    PSS-4 Scale (0-16):
      0-5: Low Perceived Stress
      6-10: Moderate Perceived Stress
      11-16: High Perceived Stress
    """
    pct = (score / max_score) * 100 if max_score > 0 else 0
    if pct <= 35:
        category = "Low Stress"
        clinical_interpretation = (
            "Stress levels appear well within adaptive, manageable physiological thresholds. "
            "Parasympathetic nervous system tone remains active and supportive of restorative sleep."
        )
        recommendations = [
            "Maintain current restorative routines and physical activity.",
            "Continue regular sleep-wake timing to protect circadian cortisol rhythm.",
        ]
    elif pct <= 68:
        category = "Moderate Stress"
        clinical_interpretation = (
            "Mild to moderate activation of the hypothalamic-pituitary-adrenal (HPA) axis. "
            "Occasional sympathetic predominance may lead to muscle tension, heightened mental fatigue, or delayed sleep onset."
        )
        recommendations = [
            "Implement cyclic sighing or box breathing (4s inhale, 4s hold, 4s exhale, 4s hold) twice daily.",
            "Schedule structured 15-minute decompression buffers between demanding work tasks.",
            "Limit evening blue light and caffeine intake within 8 hours of anticipated bedtime.",
        ]
    else:
        category = "High Stress / Acute Strain"
        clinical_interpretation = (
            "Marked HPA-axis hyperactivation and sustained sympathetic arousal. "
            "Prolonged high stress levels can impair prefrontal executive function, exacerbate subjective cognitive fog, "
            "and disrupt slow-wave sleep architecture."
        )
        recommendations = [
            "Prioritize immediate physiological decompression: 5-minute physiological sigh protocol (double inhale through nose, extended exhale through mouth).",
            "Engage 5-4-3-2-1 somatic grounding to disrupt cognitive rumination spirals.",
            "Consider consulting a clinical psychologist or licensed mental health professional.",
            "If experiencing acute emotional distress or overwhelm, 24/7 support is available via 988 Lifeline.",
        ]

    return {
        "score": score,
        "max_score": max_score,
        "category": category,
        "clinical_interpretation": clinical_interpretation,
        "evidence_based_recommendations": recommendations,
    }


def assess_anxiety_level(gad7_score: int) -> Dict[str, Any]:
    """Evaluate Generalized Anxiety Disorder 7-item (GAD-7) scale severity."""
    if gad7_score <= 4:
        severity = "Minimal Anxiety"
        guidance = "Anxiety symptoms are minimal. No formal clinical intervention indicated."
    elif gad7_score <= 9:
        severity = "Mild Anxiety"
        guidance = "Mild anxiety symptoms. Supportive lifestyle adjustments, mindfulness, and monitoring recommended."
    elif gad7_score <= 14:
        severity = "Moderate Anxiety"
        guidance = "Moderate anxiety symptoms. Clinical evaluation by a licensed counselor or psychiatrist is suggested."
    else:
        severity = "Severe Anxiety"
        guidance = "Severe anxiety symptoms. Active clinical assessment and evidence-based psychotherapy (e.g. CBT) strongly indicated."

    return {
        "score": gad7_score,
        "scale": "GAD-7",
        "severity": severity,
        "guidance": guidance,
        "crisis_support": "If panic or distress feels unmanageable, contact the 988 Suicide & Crisis Lifeline or emergency services.",
    }


# ==========================================
# 3. Neurological Red Flag Symptom Triage
# ==========================================

RED_FLAG_PATTERNS = [
    {
        "pattern": "thunderclap_headache",
        "keywords": ["thunderclap", "worst headache of my life", "sudden explosive headache"],
        "urgency": "EMERGENCY (Immediate ER / 911 / 112)",
        "condition": "Possible Subarachnoid Hemorrhage (SAH), intracranial hemorrhage, or arterial dissection.",
        "action": "Proceed to the nearest emergency department immediately. Do not drive yourself."
    },
    {
        "pattern": "stroke_symptoms_befast",
        "keywords": ["facial droop", "arm weakness", "slurred speech", "sudden loss of vision", "loss of balance", "can't lift arm", "one side numb"],
        "urgency": "EMERGENCY (Immediate ER / 911 / 112 - Time Sensitive)",
        "condition": "Possible Acute Ischemic Stroke or Hemorrhagic Event (BE-FAST signs).",
        "action": "Call emergency services immediately. Note the exact time when symptoms were first observed (critical for thrombolysis / thrombectomy eligibility)."
    },
    {
        "pattern": "meningismus",
        "keywords": ["stiff neck with fever", "photophobia with fever", "rash with stiff neck"],
        "urgency": "EMERGENCY (Immediate Medical Evaluation)",
        "condition": "Possible Acute Bacterial or Viral Meningitis / Encephalitis.",
        "action": "Requires prompt in-person emergency lumbar puncture and infectious disease evaluation."
    },
    {
        "pattern": "seizure_new_onset",
        "keywords": ["first seizure", "shaking uncontrollably", "blackout with twitching"],
        "urgency": "URGENT (Emergency / Urgent Neurology Assessment)",
        "condition": "New-onset unprovoked seizure.",
        "action": "Ensure patient safety (clear sharp objects, do not restrain or put anything in mouth, place in recovery position). Emergency evaluation required if >5 minutes or first occurrence."
    },
    {
        "pattern": "elevated_icp",
        "keywords": ["headache worse lying down", "vomiting in the morning", "blurry vision with headache", "papilledema"],
        "urgency": "URGENT (Prompt Neuro-imaging & Specialist Review)",
        "condition": "Symptoms suggestive of elevated Intracranial Pressure (ICP), hydrocephalus, or space-occupying lesion.",
        "action": "Requires in-person neurological examination and urgent contrast-enhanced MRI/CT imaging."
    }
]


def check_neurological_red_flags(text: str) -> Dict[str, Any]:
    """Screen user query or reported symptoms for acute neurological red flags."""
    lower = text.lower()
    flagged = []
    for item in RED_FLAG_PATTERNS:
        if any(kw in lower for kw in item["keywords"]):
            flagged.append({
                "urgency": item["urgency"],
                "suspected_condition": item["condition"],
                "immediate_action": item["action"],
            })

    if flagged:
        highest_urgency = "EMERGENCY" if any("EMERGENCY" in f["urgency"] for f in flagged) else "URGENT"
        return {
            "has_red_flags": True,
            "overall_urgency": highest_urgency,
            "flags": flagged,
            "disclaimer": "CORTIA is a software research workstation and cannot provide emergency medical intervention.",
        }

    return {
        "has_red_flags": False,
        "overall_urgency": "ROUTINE",
        "message": "No acute emergency neurological red flag keywords detected in query.",
    }


# ==========================================
# 4. Cognitive & Brainwave Calculators
# ==========================================

def calculate_theta_beta_ratio(theta_pct: float, beta_pct: float) -> Dict[str, Any]:
    """Compute Theta/Beta Ratio (TBR) from relative power percentages."""
    if beta_pct <= 0:
        return {"error": "Beta percentage must be greater than zero."}

    ratio = round(theta_pct / beta_pct, 2)
    if ratio < 1.0:
        state = "High Cortical Arousal / Alert Engagement"
        interpretation = "Beta activity predominates over theta, typical of focused active cognitive processing, vigilance, or elevated mental engagement."
    elif ratio <= 2.5:
        state = "Balanced Wakeful Cognitive Arousal"
        interpretation = "Healthy resting wakefulness balance between slow integrative theta and fast cortical beta oscillations."
    elif ratio <= 4.0:
        state = "Elevated Theta Dominance / Drowsiness or Cognitive Fatigue"
        interpretation = "Theta oscillations outweigh beta. Commonly observed in mental fatigue, sleep deprivation, inattention, or deep relaxation."
    else:
        state = "Markedly Elevated Theta / Marked Low Arousal"
        interpretation = "Strong theta excess relative to beta. Often examined in ADHD and attentional vigilance research."

    return {
        "theta_pct": theta_pct,
        "beta_pct": beta_pct,
        "theta_beta_ratio": ratio,
        "cognitive_state": state,
        "interpretation": interpretation,
        "scientific_note": "TBR is an exploratory electrophysiological research metric. Variations depend heavily on sensor montage, eye state (open vs. closed), and individual age norms.",
    }


# ==========================================
# 5. Crisis & Emergency Support Resources
# ==========================================

def get_crisis_support_info() -> Dict[str, Any]:
    """Retrieve 24/7 mental health and emergency crisis contact numbers."""
    return {
        "united_states_canada": {
            "suicide_crisis_lifeline": "Call or Text 988 (Free, Confidential, 24/7)",
            "crisis_text_line": "Text HOME to 741741",
            "veterans_crisis_line": "Dial 988 then press 1, or text 838255",
            "emergency_services": "911",
        },
        "united_kingdom": {
            "samaritans": "Call 116 123 (Free, 24/7)",
            "nhs_mental_health": "Call 111",
            "emergency_services": "999",
        },
        "india": {
            "tele_manas": "Call 14416 or 1800 891 4416 (Govt of India, 24/7)",
            "kiran_helpline": "Call 1800 599 0019",
            "emergency_services": "112 / 102",
        },
        "international": "https://www.findahelpline.com (Verified crisis lines worldwide)",
    }
