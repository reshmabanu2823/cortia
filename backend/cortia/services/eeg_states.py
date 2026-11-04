"""Exploratory signal patterns using existing dominant-band and TBR rules.

These rules are not a validated sleep, fatigue, or attention classifier.
"""
import math


def signal_state(session):
    valid = session.get('valid_windows', 0)
    invalid = session.get('invalid_windows', 0)
    features = session.get('features', {})
    result = dict(available=False, label='Not enough reliable signal',
                  explanation='A signal-state estimate is unavailable for this recording.',
                  evidence=[], sleep_deprivation='Not established. This recording cannot confirm whether you have had enough sleep.',
                  limitation='These are possible signal patterns, not a diagnosis or a confirmed sleep or attention state.')
    # Require three usable eight-second windows and at least half usable windows.
    if valid < 3 or valid / max(1, valid + invalid) < .5:
        result['explanation'] = 'At least three usable sections and at least half the checked sections must be usable before showing a pattern.'
        return result
    bands = {band: features.get(f'relative_{band}') for band in ('delta', 'theta', 'alpha', 'beta')}
    if any(not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1 for value in bands.values()):
        return result
    if not math.isclose(sum(bands.values()), 1, abs_tol=.05):
        return result
    result['available'] = True
    ordered = sorted(bands, key=bands.get, reverse=True)
    dominant = ordered[0]
    result['dominant_band'] = dominant
    result['evidence'] = [f'{dominant.title()} has the largest share of signal power ({bands[dominant] * 100:.1f}%).']
    if bands[dominant] - bands[ordered[1]] < .03:
        result.update(label='Mixed pattern', explanation='Several wave types have similar strength. No clear resting, alert, or drowsy pattern stands out.')
    elif dominant == 'alpha':
        result.update(label='Possible relaxed or resting pattern', explanation='Alpha waves are strongest. This can occur during quiet rest, especially with the eyes closed.')
    elif dominant == 'beta':
        result.update(label='Possible alert or engaged pattern', explanation='Beta waves are strongest. This can occur during active thinking. Muscle tension can also increase fast activity.')
    elif dominant == 'theta':
        result.update(label='Possible drowsiness or fatigue pattern', explanation='Theta waves are strongest. This can occur when becoming sleepy, but also during relaxed or mentally demanding tasks.')
    else:
        result.update(label='Slow-wave pattern; sleep-related activity is possible', explanation='Delta waves are strongest. Slow activity can occur during sleep, but eye movements and poor contact can also cause it. Sleep is not confirmed.')
    ratio = features.get('theta_beta')
    if ratio is None and bands['beta'] > 1e-6:
        ratio = bands['theta'] / bands['beta']
    if isinstance(ratio, (int, float)) and math.isfinite(ratio) and ratio >= 0:
        # Same boundaries as calculate_theta_beta_ratio in medical_tools.py.
        if ratio < 1:
            hint = 'The ratio rule suggests possible alertness because faster beta activity outweighs theta activity.'
        elif ratio <= 2.5:
            hint = 'The ratio rule does not show a clear shift toward drowsiness.'
        elif ratio <= 4:
            hint = 'The ratio rule suggests possible drowsiness or fatigue because theta activity outweighs beta activity.'
        else:
            hint = 'The ratio rule suggests reduced alertness may be possible. It does not establish a medical condition.'
        result['theta_beta_ratio'] = float(ratio)
        result['ratio_hint'] = hint
        result['evidence'].extend([f'The theta-to-beta ratio is {ratio:.2f}.', hint])
    if dominant in ('theta', 'delta') or result.get('theta_beta_ratio', 0) > 2.5:
        result['sleep_deprivation'] = 'Not confirmed. This pattern can occur with tiredness or lack of sleep, but it has other causes. Sleep history is needed.'
    if session.get('config', {}).get('source') == 'demo':
        result['limitation'] = 'Demo signal: these labels demonstrate the rules. They do not describe a person’s measured state. ' + result['limitation']
    return result
