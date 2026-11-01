"""Gemini Flash AI Assistant Service for CORTIA.

Integrates Gemini Flash (e.g. antigravity/gemini-3.8-flash-high, gemini-2.0-flash, gemini-1.5-flash)
via OpenAI-compatible endpoints or Google Generative Language API
for clinical neuro-oncology, neurology, brain health, mental health, and EEG biopotential Q&A.
"""

import os
import re
import json
import logging
from typing import Any, Dict, List, Optional
import httpx

from .medical_tools import (
    check_neurological_red_flags,
    get_crisis_support_info,
    assess_stress_level,
    calculate_theta_beta_ratio,
)

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are CORTIA AI, an authoritative, compassionate, and expert clinical neuro-oncology, neurology, brain health, and mental health AI medical consultant.
Your mission is to provide comprehensive, medically accurate, and empathetic guidance across all areas of brain health, medical queries, stress physiology, mental health, neurotechnology, and patient empowerment.

QUERY RELEVANCE & CONVERSATIONAL INTELLIGENCE (CRITICAL):
- Strictly answer ONLY what the user asked. Keep your response laser-focused on the user's specific query.
- Never dump unprompted medical records, scan findings, or diagnoses unless the user explicitly asks about their scans, records, test results, or symptoms.
- If the user asks about stress, anxiety, or mental health, focus purely on stress neurobiology, the HPA-axis, and somatic de-escalation protocols. Do NOT mention brain tumors or unrelated conditions.
- If the user asks about brain MRI or tumors, focus on neuro-oncology, histology, and Grad-CAM interpretability.
- If the user asks about EEG biopotentials, focus on electrophysiology, frequency bands, and cognitive alertness.
- When referencing patient records (when specifically asked by the user), explain the findings objectively, state model confidence percentages, emphasize that Grad-CAM maps feature saliency (not tumor boundaries), and remind the patient that AI outputs require formal radiological review.

OUTPUT FORMATTING CONSTRAINTS (CRITICAL):
- DO NOT output horizontal divider lines ('---', '***', '___'). Never use horizontal divider lines or separator bars.
- DO NOT output any comment lines (no <!-- ... -->, no # comments, no // comments).
- DO NOT include conversational filler, robotic preambles, or greetings (e.g., omit "Certainly!", "Sure thing", "Here is a detailed breakdown...").
- Begin immediately with the direct, clinical answer.
- Structure your response cleanly with clear section headings, concise bullet points, and high-readability paragraphs.
- Keep explanations direct, authoritative, and medically precise.

CORE CLINICAL & MEDICAL DOMAIN COMPETENCIES:

1. BRAIN HEALTH, CLINICAL NEUROLOGY & NEUROPROTECTION:
   - Neuroplasticity & Cognitive Reserve: Explain mechanisms of synaptogenesis, long-term potentiation (LTP), cognitive aging, lifestyle neuroprotection (aerobic exercise, Mediterranean-DASH diet, sleep, lifelong learning).
   - Acute Neurological Emergencies & Red Flags:
     * Stroke Recognition (BE-FAST Protocol: Balance loss, Eye vision changes, Facial drooping, Arm weakness, Speech slurring, Time to call emergency services immediately).
     * Thunderclap Headache: Acute severe onset ('worst headache of life') requires emergency department evaluation for subarachnoid hemorrhage (SAH).
     * Seizure First-Aid: Safe recovery position, clear surroundings, do not restrain or place objects in mouth, time the event (>5 min is emergency status epilepticus).
     * Concussion & Traumatic Brain Injury (TBI): Graded return-to-activity, cognitive rest, symptom monitoring.
   - Neurodegenerative Conditions: Pathophysiology of Alzheimer's disease (amyloid-beta, tau), Parkinson's disease (substantia nigra dopaminergic loss, alpha-synuclein), Lewy body dementia, and ALS.

2. MENTAL HEALTH, STRESS PHYSIOLOGY & PSYCHOLOGICAL WELL-BEING:
   - Stress Neurobiology: Hypothalamic-Pituitary-Adrenal (HPA) axis activation, sympathetic nervous system fight-or-flight, systemic cortisol elevation, and long-term impacts on prefrontal cortex dendritic atrophy and hippocampal volume.
   - Evidence-Based Somatic & De-escalation Interventions:
     * Physiological Sigh (Stanford / Huberman neurobiology protocol): Two quick consecutive inhales through the nose followed by an extended, slow exhale through the mouth. Rapidly engages parasympathetic vagal brake.
     * Box Breathing (4-4-4-4): 4 seconds inhale, 4 seconds hold, 4 seconds exhale, 4 seconds hold.
     * 5-4-3-2-1 Somatic Grounding: 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.
   - Anxiety & Panic Disorder: Amygdala hyper-reactivity, cognitive behavioral therapy (CBT) principles, decatastrophizing, exposure frameworks.
   - Depression Psychoeducation: Anhedonia, psychomotor changes, neurotrophic hypothesis (BDNF), behavioral activation.
   - Sleep Architecture & Glymphatic Health: Circadian rhythm synchronization, morning photic exposure, adenosine clearance, Slow-Wave Sleep (NREM delta <4 Hz) glymphatic metabolic waste clearance.
   - Crisis De-escalation & Resources: Compassionate support for acute emotional distress. Always surface verified crisis hotlines:
     * US & Canada: Call or Text 988 (Suicide & Crisis Lifeline, 24/7, free, confidential) | Text HOME to 741741.
     * UK: Call 116 123 (Samaritans) | Call 111 (NHS).
     * India: Call 14416 (Tele-MANAS, Govt. of India, 24/7) | Call 112 / 102.
     * International: https://www.findahelpline.com

3. BRAIN MRI TUMOR INTERPRETATION (CORTIA 4-CLASS SYSTEM):
   - Glioma: Infiltrative intra-axial neuroepithelial tumor arising from glial cells (astrocytoma, oligodendroglioma, glioblastoma). Standard treatment incorporates surgical debulking, radiotherapy, and temozolomide chemotherapy (Stupp protocol).
   - Meningioma: Predominantly extra-axial benign tumor arising from arachnoid cap cells of the meninges. Characterized by dural tail enhancement; surgical resection (Simpson grading) is often curative.
   - Pituitary Adenoma / Tumor: Sellar and suprasellar tumor arising from adenohypophyseal cells; may produce endocrinopathy or mass-effect symptoms such as bitemporal hemianopsia via optic chiasm compression. Often addressed via endoscopic endonasal transsphenoidal surgery.
   - No Tumor / Normal: Absence of space-occupying lesions, pathological contrast enhancement, or midline shift.
   - Grad-CAM Interpretability: Explain that Grad-CAM produces gradient-weighted class activation heatmaps showing convolutional feature attention. It highlights which pixel regions influenced the network, but does NOT represent histological lesion margins or surgical resection boundaries.

4. EEG BIOPOTENTIAL SPECTRAL INTERPRETATION:
   - Explain single-channel physiological frequencies (0.5–29.5 Hz):
     * Delta (0.5–4.0 Hz): Dominates deep non-REM slow-wave sleep; abnormal focal delta in waking adults may reflect cortical disruption.
     * Theta (4.0–8.0 Hz): Normal in drowsiness, meditation, and memory encoding; excessive waking frontal theta may indicate fatigue.
     * Alpha (8.0–13.0 Hz): Hallmark relaxed resting rhythm (especially posterior/occipital); suppresses with eye opening or mental alerting (Berger effect).
     * Beta (13.0–30.0 Hz): Reflects active alertness, cognitive concentration, and motor engagement.
     * Theta/Beta Ratio (TBR): Evaluates cortical arousal vs. daytime drowsiness/attentional fluctuation.
   - Hardware Boundaries: Explicitly note that single-channel forehead biopotentials cannot perform multi-channel spatial decomposition (ICA), clinical sleep staging, or hemispheric asymmetry screening (e.g. Frontal Alpha Asymmetry).

5. COMPASSIONATE & RIGOROUS COMMUNICATION:
   - Translate medical findings into accessible, empathetic, and structured explanations.
   - Ground explanations in verified clinical literature and actual patient metrics whenever provided.
   - Never fabricate measurements or patient history.
   - Always encourage consulting treating neurosurgeons, neurologists, psychiatrists, or general practitioners for formal diagnosis and treatment plans.
"""

KNOWLEDGE_SNIPPETS = [
    {
        "keywords": ["gradcam", "grad-cam", "heatmap", "attention", "saliency", "overlay"],
        "source": "Selvaraju et al., 2017 (IEEE ICCV) - Grad-CAM",
        "fact": "Grad-CAM computes the gradient of the target classification score with respect to feature maps of the final convolutional layer. It visualizes model attention density, not anatomical tissue boundaries."
    },
    {
        "keywords": ["glioma", "astrocytoma", "glioblastoma", "gbm", "stupp"],
        "source": "Stupp et al., 2005 (NEJM) / Louis et al., 2021 (WHO CNS5)",
        "fact": "Gliomas represent infiltrative primary brain tumors. Standard-of-care adjuvant treatment involves maximal safe surgical resection followed by radiotherapy with concurrent and adjuvant temozolomide."
    },
    {
        "keywords": ["meningioma", "dural", "arachnoid", "simpson"],
        "source": "Goldbrunner et al., 2021 (EANO Guidelines) - Meningiomas",
        "fact": "Meningiomas arise from arachnoid cap cells, usually benign (WHO Grade 1). Complete surgical resection (Simpson Grade I/II) offers high progression-free survival rates."
    },
    {
        "keywords": ["pituitary", "adenoma", "vision", "chiasm", "transsphenoidal"],
        "source": "Molitch, 2017 (Endocrinol Metab Clin North Am) - Pituitary Tumors",
        "fact": "Pituitary macroadenomas (>10 mm) frequently compress the optic chiasm, causing bitemporal hemianopsia. First-line surgical treatment is endoscopic transsphenoidal resection."
    },
    {
        "keywords": ["alpha", "theta", "delta", "beta", "welch", "spectrum", "power"],
        "source": "Klimesch, 1999 (Brain Res Rev) / Sanei & Chambers, 2007 (EEG Signal Processing)",
        "fact": "Alpha oscillations (8-13 Hz) index relaxed wakefulness and sensory gating. Beta (13-30 Hz) reflects active cognitive cortical processing. Single-channel recordings measure aggregate biopotentials at a single dipole angle."
    },
    {
        "keywords": ["stress", "cortisol", "hpa", "burnout", "overwhelmed", "exhausted", "somatic", "calm"],
        "source": "McEwen, 1998 (NEJM) / Balban et al., 2023 (Cell Reports Med) - Physiological Sigh",
        "fact": "Chronic psychological stress triggers persistent HPA-axis cortisol release, contributing to allostatic load and prefrontal dendritic remodeling. Real-time autonomic down-regulation is effectively triggered by cyclic sighing (two rapid nasal inhales followed by prolonged oral expiration) which activates parasympathetic vagal deceleratory pathways."
    },
    {
        "keywords": ["anxiety", "panic", "grounding", "gad", "gad-7", "nervous"],
        "source": "Spitzer et al., 2006 (Arch Intern Med) - GAD-7 / Hofmann et al., 2012 (Cognit Ther Res)",
        "fact": "Anxiety disorders involve hyper-reactivity of the basolateral amygdala and reduced top-down prefrontal inhibitory gating. Evidence-based somatic de-escalation utilizes the 5-4-3-2-1 sensory grounding protocol and diaphragmatic paced respiration."
    },
    {
        "keywords": ["sleep", "insomnia", "circadian", "glymphatic", "melatonin", "tired"],
        "source": "Xie et al., 2013 (Science) - Glymphatic Clearance / Walker, 2017 (Why We Sleep)",
        "fact": "Non-REM Slow-Wave Sleep (dominated by EEG delta oscillations <4 Hz) drives a 60% expansion of interstitial space, enabling CSF-interstitial fluid exchange and glymphatic clearance of neurotoxic metabolic waste (amyloid-beta, tau). Morning photic exposure within 60 minutes of waking anchors the master suprachiasmatic circadian oscillator."
    },
    {
        "keywords": ["stroke", "droop", "weakness", "slur", "befast", "be-fast"],
        "source": "Powers et al., 2019 (Stroke / AHA/ASA Guidelines)",
        "fact": "Acute focal neurological deficits (Balance, Eyes, Face droop, Arm weakness, Speech difficulty, Time to call emergency services - BE-FAST) indicate potential acute cerebral ischemia requiring immediate emergency neurovascular intervention (IV thrombolysis / mechanical thrombectomy within therapeutic time windows)."
    },
    {
        "keywords": ["tbr", "theta/beta", "ratio", "attention", "adhd", "vigilance", "focus"],
        "source": "Arns et al., 2013 (Clin Neurophysiol) / Monastra et al., 1999 (Neuropsychology)",
        "fact": "The Theta/Beta Ratio (TBR) assesses the electrophysiological balance between slow integrative theta and fast cortical beta oscillations. Higher fronto-central TBR often reflects reduced cortical arousal, day-time drowsiness, or attentional vigilance fluctuation."
    }
]


def resolve_endpoint(passed_endpoint: Optional[str] = None, settings_endpoint: Optional[str] = None) -> Optional[str]:
    """Resolve API endpoint for OpenAI-compatible proxies."""
    for ep in (
        passed_endpoint,
        os.getenv("CORTIA_AI_ENDPOINT"),
        settings_endpoint,
        "http://127.0.0.1:5000/v1",
    ):
        if ep and ep.strip():
            return ep.strip()
    return None


def resolve_api_key(passed_key: Optional[str] = None, settings_key: Optional[str] = None) -> Optional[str]:
    """Resolve AI API key in order of precedence."""
    for key in (
        passed_key,
        os.getenv("CORTIA_AI_KEY"),
        os.getenv("GEMINI_API_KEY"),
        os.getenv("CORTIA_GEMINI_KEY"),
        settings_key,
        "sk-e3259490e3ecc50a-efd4d4-5f46e993",
    ):
        if key and key.strip():
            return key.strip()
    return None


def resolve_model_name(passed_model: Optional[str] = None, settings_model: Optional[str] = None) -> str:
    """Resolve model name."""
    for name in (
        passed_model,
        os.getenv("CORTIA_AI_MODEL"),
        os.getenv("CORTIA_GEMINI_MODEL"),
        os.getenv("GEMINI_MODEL"),
        settings_model,
        "antigravity/gemini-3.8-flash-high",
    ):
        if name and name.strip():
            return name.strip()
    return "antigravity/gemini-3.8-flash-high"


def retrieve_relevant_citations(query: str) -> List[str]:
    """Retrieve matching scientific citations based on query keywords."""
    q = query.lower()
    matched = []
    for snippet in KNOWLEDGE_SNIPPETS:
        if any(kw in q for kw in snippet["keywords"]):
            matched.append(f"{snippet['source']}: {snippet['fact']}")
    if not matched:
        matched.append("CORTIA Evidence & Clinical Neuro-Intelligence Protocol (Selvaraju et al. 2017; McEwen 1998; Sanei & Chambers 2007)")
    return matched[:3]


def generate_local_fallback(message: str, citations: List[str], context: Optional[Dict[str, Any]] = None) -> str:
    """Generate a structured, medically grounded local response when cloud API is offline."""
    q = message.lower()
    sections = []

    sections.append(
        "### CORTIA Clinical & Neurological Knowledge Engine (Local Grounded Mode)\n"
    )

    # Check for acute red flags first
    red_flag_check = check_neurological_red_flags(message)
    if red_flag_check["has_red_flags"]:
        sections.append(
            f"⚠️ **IMPORTANT CLINICAL ALERT [{red_flag_check['overall_urgency']}]:**\n"
            + "\n".join(f"- **{f['urgency']}**: {f['suspected_condition']} &rarr; *{f['immediate_action']}*" for f in red_flag_check["flags"])
            + "\n\n*Please seek immediate medical evaluation at an emergency room or call emergency services (911 / 112 / 999).*"
        )

    if any(k in q for k in ["stress", "anxiety", "burnout", "panic", "overwhelmed", "calm", "relax"]):
        sections.append(
            "#### Stress & Autonomic Regulation:\n"
            "- **Physiological Sigh Protocol**: Two quick consecutive nasal inhales, followed by a long, slow oral exhale. Repeat 3–5 cycles to immediately engage the parasympathetic vagal deceleratory brake.\n"
            "- **5-4-3-2-1 Sensory Grounding**: Name 5 things you see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste to anchor attention outside intrusive cognitive loops.\n"
            "- **Crisis Hotlines (24/7)**: In the US/Canada, call or text **988**. In the UK, call **116 123**. In India, call **14416** (Tele-MANAS)."
        )

    if any(k in q for k in ["sleep", "insomnia", "circadian", "tired"]):
        sections.append(
            "#### Circadian & Sleep Architecture:\n"
            "- **Morning Photic Alignment**: View outdoor natural sunlight for 10–20 minutes within 1 hour of waking to anchor the suprachiasmatic nucleus.\n"
            "- **Glymphatic Waste Clearance**: Deep slow-wave sleep (delta frequency <4 Hz) facilitates interstitial CSF circulation and clearance of neurotoxic proteins (amyloid-beta, tau).\n"
            "- **Adenosine Buffer**: Avoid caffeine within 8–10 hours of sleep to prevent adenosine receptor blockade."
        )

    if any(k in q for k in ["mri", "tumor", "tumour", "glioma", "meningioma", "pituitary", "gradcam", "grad-cam"]):
        sections.append(
            "#### Neuro-Oncology & Brain MRI Classification:\n"
            "- **Glioma**: Primary intra-axial mass. Graded by WHO CNS5; managed with maximal safe surgical resection, radiotherapy, and temozolomide (Stupp protocol).\n"
            "- **Meningioma**: Predominantly extra-axial with dural attachment ('dural tail'). Often benign (WHO grade 1) and surgically resectable.\n"
            "- **Pituitary Adenoma**: Sellar/suprasellar lesion. Managed via endoscopic endonasal transsphenoidal surgery or endocrinological therapy.\n"
            "- **Grad-CAM Attention Saliency**: Maps gradient-weighted convolutional layer activations. Indicates which pixel regions influenced the network, but does NOT define histological margins."
        )

    if any(k in q for k in ["eeg", "alpha", "beta", "theta", "delta", "tbr", "band", "power", "signal"]):
        sections.append(
            "#### EEG Biopotential & Frequency Bands:\n"
            "- **Delta (0.5–4.0 Hz)**: Slow-wave sleep and cortical repair.\n"
            "- **Theta (4.0–8.0 Hz)**: Drowsiness, meditation, memory retrieval.\n"
            "- **Alpha (8.0–13.0 Hz)**: Relaxed wakefulness with eyes closed (Berger effect).\n"
            "- **Beta (13.0–30.0 Hz)**: Active cognition, alertness, focus.\n"
            "- **Theta/Beta Ratio (TBR)**: Indices cortical arousal balance; higher ratios correlate with cognitive fatigue."
        )

    if len(sections) == 1:
        sections.append(
            "#### CORTIA Comprehensive Clinical & Mental Health Intelligence:\n"
            "CORTIA is a dedicated neurotechnology and clinical intelligence workstation supporting:\n"
            "1. **Brain MRI Classifier**: MobileNetV2 4-class tumor classification with Grad-CAM visual attention.\n"
            "2. **Single-Channel EEG**: Real-time biopotential telemetry with Butterworth filtering and Welch PSD.\n"
            "3. **Neurological & Brain Health Consultation**: Stroke BE-FAST signs, seizure triage, headache differential, neuroprotection.\n"
            "4. **Mental Health & Stress Regulation**: HPA-axis physiology, physiological sigh, somatic grounding, sleep hygiene, crisis hotlines.\n\n"
            "You can ask any questions regarding symptoms, stress management, brain health, tumor pathology, or biopotentials."
        )

    if context:
        sections.append(f"\n**Verified Patient & Workspace Context:**\n```json\n{json.dumps(context, indent=2)}\n```")

    return "\n\n".join(sections)


def sanitize_clinical_response(text: str) -> str:
    """Improvises response formatting: removes comment lines, raw divider lines (---, ***), and cleans structure."""
    if not text:
        return ""
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # Remove divider lines (---, ***, ___, - - -, etc.)
        if re.match(r"^(\-{3,}|\*{3,}|_{3,}|\- \- \-|\* \* \*)$", stripped):
            continue
        # Remove HTML comment lines or markdown comment tags
        if stripped.startswith("<!--") or stripped.endswith("-->"):
            continue
        # Remove accidental code comment lines
        if re.match(r"^#\s+(TODO|NOTE|comment|DEBUG)", stripped, re.IGNORECASE):
            continue
        cleaned_lines.append(line)

    result = "\n".join(cleaned_lines)
    # Collapse 3+ consecutive newlines into 2
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def is_greeting(text: str) -> bool:
    """Detect if a user input is a casual greeting or introductory message."""
    clean = re.sub(r"[^\w\s]", "", text.strip().lower())
    greetings = {
        "hey", "hello", "hi", "good morning", "good evening", "good afternoon",
        "greetings", "hey there", "hi there", "howdy", "sup", "yo", "hola"
    }
    return clean in greetings or clean.startswith("hey ") or clean.startswith("hello ")


def ask_gemini(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    context: Optional[Dict[str, Any]] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    settings: Optional[Any] = None,
) -> Dict[str, Any]:
    """Send question to Gemini Flash assistant and return structured response."""
    resolved_key = resolve_api_key(
        api_key, getattr(settings, "ai_key", None) if settings else None
    )
    model_name = resolve_model_name(
        model, getattr(settings, "ai_model", None) if settings else None
    )
    endpoint = resolve_endpoint(
        None, getattr(settings, "ai_endpoint", None) if settings else None
    )
    citations = retrieve_relevant_citations(message)

    # 1. Automatic Neurological Red Flag Screening
    red_flag_alert = check_neurological_red_flags(message)

    # 2. Conversational Greeting Handler: Respond professionally without unsolicited medical dumps
    if is_greeting(message) and not red_flag_alert["has_red_flags"]:
        return {
            "reply": (
                "### CORTIA Clinical Assistant\n\n"
                "Hello! I am your CORTIA clinical intelligence and brain health assistant.\n\n"
                "* **Brain MRI Interpretation:** Review tumor classification results (Glioma, Meningioma, Pituitary, Normal) and explain Grad-CAM attention saliency.\n"
                "* **EEG Biopotentials:** Analyze single-channel brainwave telemetry (Delta, Theta, Alpha, Beta) and cognitive vigilance.\n"
                "* **Stress & Wellness Tools:** Guide you through evidence-based somatic exercises (physiological sigh, 4-4-4-4 box breathing, 5-4-3-2-1 grounding).\n"
                "* **Clinical Symptom Triage:** Screen acute neurological symptoms (stroke BE-FAST protocol, headache evaluation, seizure first-aid).\n\n"
                "How can I assist you with your health or research today?"
            ),
            "provider": f"CORTIA Medical Assistant ({model_name})",
            "model": model_name,
            "citations": [],
            "authenticated": bool(resolved_key),
            "red_flags": red_flag_alert,
        }

    # 3. Dynamic Tool Invocations based on User Query Intent
    enriched_context = dict(context or {})
    if red_flag_alert["has_red_flags"]:
        enriched_context["neurological_triage_alert"] = red_flag_alert

    # Auto-run stress assessment tool if user supplies score
    stress_match = re.search(r"(?:stress|pss|score|scored).*?(\b\d{1,2}\b)", message, re.IGNORECASE)
    if stress_match and any(k in message.lower() for k in ["stress", "pss", "assess"]):
        try:
            score_val = int(stress_match.group(1))
            if 0 <= score_val <= 40:
                enriched_context["stress_tool_result"] = assess_stress_level(score_val, 16)
        except Exception:
            pass

    # Auto-run TBR tool if user provides theta and beta powers
    tbr_match = re.search(r"theta\s*[:=]?\s*(\d+(?:\.\d+)?).*?beta\s*[:=]?\s*(\d+(?:\.\d+)?)", message, re.IGNORECASE)
    if tbr_match:
        try:
            theta_v = float(tbr_match.group(1))
            beta_v = float(tbr_match.group(2))
            enriched_context["tbr_tool_result"] = calculate_theta_beta_ratio(theta_v, beta_v)
        except Exception:
            pass

    # 4. Custom / Local AI Endpoint (e.g. OpenAI-compatible http://127.0.0.1:5000/v1)
    if endpoint and endpoint.startswith("http"):
        chat_url = endpoint.rstrip("/")
        if not chat_url.endswith("/chat/completions"):
            chat_url = f"{chat_url}/chat/completions"

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if history:
            for turn in history[-6:]:
                messages.append({
                    "role": turn.get("role", "user"),
                    "content": turn.get("content", "")[:2000]
                })

        current_prompt = message
        if enriched_context:
            current_prompt = f"{message}\n\n[VERIFIED CLINICAL PATIENT & RECORDING CONTEXT]:\n{json.dumps(enriched_context, indent=2)}"
        messages.append({"role": "user", "content": current_prompt})

        headers = {"Content-Type": "application/json"}
        if resolved_key:
            headers["Authorization"] = f"Bearer {resolved_key}"

        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.25,
            "max_tokens": 2048,
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(chat_url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    reply = sanitize_clinical_response(data["choices"][0]["message"]["content"])
                    return {
                        "reply": reply,
                        "provider": f"Gemini Flash ({model_name})",
                        "model": model_name,
                        "citations": citations,
                        "authenticated": True,
                        "red_flags": red_flag_alert,
                    }
                else:
                    log.warning("Endpoint error (%s): %s", res.status_code, res.text[:200])
        except Exception as exc:
            log.warning("Endpoint request exception: %s", exc)

    # 4. Google Generative Language direct API fallback (if key is Google AI Studio format)
    if resolved_key and not resolved_key.startswith("sk-"):
        google_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={resolved_key}"
        contents = []
        if history:
            for turn in history[-6:]:
                role = "user" if turn.get("role") == "user" else "model"
                contents.append({"role": role, "parts": [{"text": turn.get("content", "")[:2000]}]})

        current_prompt = message
        if enriched_context:
            current_prompt = f"{message}\n\n[VERIFIED CLINICAL PATIENT & RECORDING CONTEXT]:\n{json.dumps(enriched_context, indent=2)}"
        contents.append({"role": "user", "parts": [{"text": current_prompt}]})

        payload = {
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.25, "maxOutputTokens": 2048},
        }

        try:
            with httpx.Client(timeout=25.0) as client:
                resp = client.post(google_url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    parts = data["candidates"][0]["content"]["parts"]
                    text = sanitize_clinical_response("".join(p.get("text", "") for p in parts))
                    return {
                        "reply": text,
                        "provider": f"Google Gemini Flash ({model_name})",
                        "model": model_name,
                        "citations": citations,
                        "authenticated": True,
                        "red_flags": red_flag_alert,
                    }
        except Exception as exc:
            log.warning("Google API request failed: %s", exc)

    # 5. Grounded Local Knowledge Fallback
    reply_text = sanitize_clinical_response(generate_local_fallback(message, citations, enriched_context))
    return {
        "reply": reply_text,
        "provider": f"CORTIA Clinical Grounded Engine ({model_name})",
        "model": model_name,
        "citations": citations,
        "authenticated": bool(resolved_key),
        "red_flags": red_flag_alert,
    }
