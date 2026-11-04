"""Evidence-only language; optional AI selects allowed statements, never writes findings."""
import hashlib
import json
import re
import httpx
from .eeg_states import signal_state


def evidence(session, baseline):
    result = []
    def add(key, text):
        result.append({'id': key, 'text': text})
    valid = session['valid_windows']
    invalid = session['invalid_windows']
    if not valid:
        add('quality', 'No usable eight-second EEG windows are available. Brainwave interpretation is unavailable.')
    else:
        add('quality', f'This recording contains {valid} usable and {invalid} rejected eight-second windows under exploratory quality checks.')
        features = session['features']
        bands = {k.removeprefix('relative_'): v for k, v in features.items() if k.startswith('relative_')}
        if bands:
            dominant = max(bands, key=bands.get)
            add('prominent', f'{dominant.title()} has the largest mean relative power: {bands[dominant]*100:.1f}% of retained 0.5–29.5 Hz power.')
        for band, value in bands.items():
            add('band_' + band, f'Mean {band} relative band power is {value*100:.1f}%.')
    if session['missing_samples']:
        add('gaps', f'{session["missing_samples"]} missing samples were detected. Affected windows are excluded from feature interpretation.')
    if baseline and baseline.get('available'):
        if baseline['included_in_baseline']:
            add('cohort', 'This session contributes to the selected baseline; comparison is in-sample, not independent change detection.')
        for name, change in baseline['deviations'].items():
            if change['flagged']:
                add('deviation_' + name, f'{name.replace("_"," ")} differs by {change["z_score"]:.2f} baseline standard deviations. This is an exploratory statistical flag.')
    else:
        add('baseline', 'No matching personal baseline is available. Independent change detection requires sufficient comparable recordings.')
    add('limits', 'Single-channel EEG and these ratios cannot establish attention, intelligence, anxiety, depression or a neurological diagnosis.')
    return result


def human_friendly_explanation(session, baseline=None):
    """Translates sensed EEG data into intuitive visual data and plain, non-technical human language."""
    valid = session.get('valid_windows', 0)
    invalid = session.get('invalid_windows', 0)
    total = valid + invalid
    context = session.get('context', {})
    eyes = context.get('eyes', 'closed')
    task = context.get('task', 'rest')
    montage = context.get('montage', 'forehead')
    features = session.get('features', {})
    pattern = signal_state(session)
    if not pattern['available']:
        return dict(state_title=pattern['label'], state_badge='Interpretation unavailable', state_badge_color='warning',
                    summary=pattern['explanation'], band_breakdown=[], tbr_score=None,
                    signal_clarity=f'{valid} usable / {total} checked sections',
                    what_it_means=[pattern['sleep_deprivation'], pattern['limitation']])

    if not valid:
        return {
            'state_title': 'Short Test Session (Need 15–30 Seconds)',
            'state_badge': 'Quick Trial',
            'state_badge_color': 'warning',
            'summary': (
                f"This session was recorded with eyes {eyes}. "
                "Only a brief moment was captured, which was too short to show your full brainwave rhythm. "
                "The forehead sensor needs about 15 to 30 seconds of quiet, steady contact to show your clear brain state."
            ),
            'what_it_means': [
                "Your sensor was only active for a few seconds.",
                "Normal blinks or adjusting the headband easily interrupt short recordings."
            ],
            'what_to_do_next': "Put on the headband comfortably, relax your face, and let it record for 30–60 seconds.",
            'band_breakdown': [],
            'tbr_score': None,
            'signal_clarity': 'Brief capture (Try a 30s session)'
        }

    bands = {k.removeprefix('relative_'): v for k, v in features.items() if k.startswith('relative_')}
    if not bands:
        return {
            'state_title': 'Calculating Brain Activity...',
            'state_badge': 'Processing',
            'state_badge_color': 'warning',
            'summary': 'Data was received, but full wave percentages could not be determined.',
            'band_breakdown': [],
            'signal_clarity': 'Data captured'
        }

    alpha_pct = round(bands.get('alpha', 0.0) * 100, 1)
    beta_pct = round(bands.get('beta', 0.0) * 100, 1)
    theta_pct = round(bands.get('theta', 0.0) * 100, 1)
    delta_pct = round(bands.get('delta', 0.0) * 100, 1)

    dominant = max(bands, key=bands.get)
    clean_pct = round((valid / total * 100), 1) if total > 0 else 0
    tbr = features.get('theta_beta', features.get('tbr'))
    if tbr is None and beta_pct > 0:
        tbr = round(theta_pct / beta_pct, 2)

    if dominant == 'alpha':
        state_title = f'Calm & Peaceful Relaxation ({alpha_pct}%)'
        state_badge = 'Calm & Restful'
        state_badge_color = 'success'
        core_meaning = (
            f"Your brain spent {alpha_pct}% of the session in a tranquil, relaxed state. "
            "These calm waves naturally surge when you close your eyes and let your mind unwind."
        )
    elif dominant == 'beta':
        state_title = f'Active Focus & Sharp Concentration ({beta_pct}%)'
        state_badge = 'Active & Focused'
        state_badge_color = 'primary'
        core_meaning = (
            f"Your brain was actively working with {beta_pct}% focus waves. "
            "These fast waves surge when you are reading, problem-solving, or paying close attention."
        )
    elif dominant == 'theta':
        state_title = f'Daydreaming & Winding Down ({theta_pct}%)'
        state_badge = 'Daydream Mode'
        state_badge_color = 'warning'
        core_meaning = (
            f"Your mind spent {theta_pct}% in a gentle twilight zone—the cozy, dreamy state "
            "typical of light meditation, mind wandering, or transitioning into sleep."
        )
    else:
        state_title = f'Deep Rest & Sleep Mode ({delta_pct}%)'
        state_badge = 'Deep Rest'
        state_badge_color = 'neutral'
        if clean_pct < 50:
            core_meaning = (
                f"Your session showed {delta_pct}% slow rest waves. "
                "These slow waves naturally dominate deep sleep, but forehead sensors also pick them up "
                "from natural eye blinks or slight face movements."
            )
        else:
            core_meaning = (
                f"Your mind was in a deep resting mode ({delta_pct}%). "
                "These slow waves take over when your body completely lets go of tension and rests deeply."
            )

    band_cards = [
        {
            'name': 'Deep Rest & Sleep',
            'technical_tag': 'Delta',
            'role': 'Physical rest & recovery',
            'percentage': delta_pct,
            'simple_desc': 'The slowest brainwave. Dominates during deep restorative sleep.',
            'color': '#C94040'
        },
        {
            'name': 'Daydreaming & Twilight',
            'technical_tag': 'Theta',
            'role': 'Gentle unwinding',
            'percentage': theta_pct,
            'simple_desc': 'Present when your mind wanders, meditates, or feels sleepy.',
            'color': '#E67E22'
        },
        {
            'name': 'Calm & Relaxation',
            'technical_tag': 'Alpha',
            'role': 'Quiet, peaceful mind',
            'percentage': alpha_pct,
            'simple_desc': 'Surges when your eyes are closed and stress melts away.',
            'color': '#27AE60'
        },
        {
            'name': 'Active Focus & Thinking',
            'technical_tag': 'Beta',
            'role': 'Problem solving & alertness',
            'percentage': beta_pct,
            'simple_desc': 'Rises when you are actively thinking, reading, or concentrating.',
            'color': '#2980B9'
        }
    ]

    tbr_val = tbr if tbr is not None else 1.0
    if tbr_val < 2.0:
        alertness_label = 'Sharp & Mentally Engaged'
    elif tbr_val <= 3.5:
        alertness_label = 'Balanced Calm & Alert'
    else:
        alertness_label = 'Drowsy / Time for Rest'

    if clean_pct >= 75:
        quality_msg = f'{clean_pct}% Steady Contact · Clear and reliable'
    elif clean_pct >= 40:
        quality_msg = f'{clean_pct}% Usable Contact · A few blinks or shifts detected'
    else:
        quality_msg = f'{clean_pct}% Steady Contact · Blinks or motion detected'

    return {
        'state_title': pattern['label'],
        'state_badge': pattern['label'],
        'state_badge_color': state_badge_color,
        'summary': pattern['explanation'] + ' ' + pattern['sleep_deprivation'],
        'dominant_band': dominant.title(),
        'clean_pct': clean_pct,
        'valid_windows': valid,
        'total_windows': total,
        'montage': montage,
        'eyes': eyes,
        'task': task,
        'band_breakdown': band_cards,
        'alertness_label': pattern.get('ratio_hint', 'No reliable ratio-based estimate'),
        'tbr_score': pattern.get('theta_beta_ratio'),
        'what_it_means': pattern['evidence'] + [pattern['limitation']],
        'signal_clarity': quality_msg,
        'tip': 'For the steadiest reading, sit comfortably and relax your forehead muscles.' if clean_pct < 60 else 'Great recording with steady sensor contact.'
    }


def select_statements(payload, statements):
    if not isinstance(payload, dict) or set(payload) != {'statement_ids'}:
        raise ValueError('AI output must contain statement_ids only')
    selected = payload['statement_ids']
    allowed = {s['id']: s['text'] for s in statements}
    if not isinstance(selected, list) or not 1 <= len(selected) <= len(allowed) or any(not isinstance(k, str) or k not in allowed for k in selected) or len(set(selected)) != len(selected):
        raise ValueError('AI selected unsupported statements')
    # Always preserve quality and limitations, irrespective of model preference.
    ids = list(dict.fromkeys(['quality', *selected, 'limits']))
    return [allowed[k] for k in ids if k in allowed]


def explain(session, baseline, settings, use_ai=False):
    statements = evidence(session, baseline)
    human_expl = human_friendly_explanation(session, baseline)
    digest = hashlib.sha256(json.dumps({'session': session, 'baseline': baseline}, sort_keys=True, allow_nan=False).encode()).hexdigest()
    if not use_ai:
        return dict(
            kind='evidence_summary',
            provider='backend_templates',
            ai_generated=False,
            statements=[s['text'] for s in statements],
            human_explanation=human_expl,
            evidence_digest=digest
        )
    if not settings.ai_endpoint or not settings.ai_model:
        raise ValueError('External AI is not configured. Evidence summary remains available.')

    endpoint = settings.ai_endpoint.rstrip('/')
    if not endpoint.endswith('/chat/completions'):
        endpoint = f'{endpoint}/chat/completions'

    response = httpx.post(
        endpoint,
        headers={'Authorization': f'Bearer {settings.ai_key}'},
        timeout=25,
        json={
            'model': settings.ai_model,
            'temperature': 0,
            'max_tokens': 1024,
            'messages': [
                {'role': 'system', 'content': 'Select the most useful statement IDs from the provided list. Return JSON only in this exact format: {"statement_ids":["id"]}. Never add extra keys or measurements.'},
                {'role': 'user', 'content': json.dumps(statements)}
            ],
            'response_format': {'type': 'json_object'}
        }
    )
    response.raise_for_status()
    if len(response.content) > 65536:
        raise ValueError('AI response exceeds limit')

    raw_content = response.json()['choices'][0]['message']['content'].strip()
    cleaned_content = re.sub(r"^```(?:json)?\s*", "", raw_content, flags=re.MULTILINE)
    cleaned_content = re.sub(r"\s*```$", "", cleaned_content, flags=re.MULTILINE).strip()

    try:
        payload = json.loads(cleaned_content)
    except Exception:
        match = re.search(r'\"statement_ids\"\s*:\s*(\[[^\]]*\])', cleaned_content)
        if match:
            try:
                payload = {'statement_ids': json.loads(match.group(1))}
            except Exception:
                raise ValueError('Invalid AI statement JSON format')
        else:
            raise ValueError('Invalid AI statement selection output')

    text = select_statements(payload, statements)
    return dict(
        kind='ai_assisted_evidence_selection',
        provider=settings.ai_model,
        ai_generated=True,
        statements=text,
        human_explanation=human_expl,
        evidence_digest=digest
    )
