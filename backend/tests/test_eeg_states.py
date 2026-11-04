import pytest
from cortia.services.eeg_states import signal_state
from cortia.services.explanations import human_friendly_explanation


def recording(values, **extra):
    return dict(valid_windows=12, invalid_windows=0, features={f'relative_{key}': value for key, value in zip(('delta', 'theta', 'alpha', 'beta'), values)}, **extra)


@pytest.mark.parametrize('values, expected', [
    ((.05, .1, .75, .1), 'relaxed or resting'),
    ((.05, .1, .1, .75), 'alert or engaged'),
    ((.1, .6, .1, .2), 'drowsiness or fatigue'),
    ((.7, .1, .1, .1), 'Slow-wave pattern'),
    ((.25, .25, .25, .25), 'Mixed pattern'),
])
def test_recording_pattern_changes_with_acquired_bands(values, expected):
    session = recording(values)
    result = signal_state(session)
    assert result['available']
    assert expected in result['label']
    assert 'Not confirmed' in result['sleep_deprivation'] or 'Not established' in result['sleep_deprivation']
    assert human_friendly_explanation(session)['state_title'] == result['label']


@pytest.mark.parametrize('valid, invalid', [(0, 12), (2, 0), (3, 9)])
def test_quality_gate_withholds_interpretation(valid, invalid):
    session = recording((.1, .6, .1, .2))
    session.update(valid_windows=valid, invalid_windows=invalid)
    assert not signal_state(session)['available']
    assert human_friendly_explanation(session)['state_title'] == 'Not enough reliable signal'


def test_stored_ratio_used_without_recomputing_ratio_of_session_means():
    session = recording((.1, .5, .2, .2))
    session['features']['theta_beta'] = 3.5
    result = signal_state(session)
    assert result['theta_beta_ratio'] == 3.5
    assert 'possible drowsiness or fatigue' in result['ratio_hint']


def test_demo_provenance_and_missing_beta_do_not_invent_results():
    result = signal_state(recording((.1, .6, .3, 0), config={'source': 'demo'}))
    assert 'theta_beta_ratio' not in result
    assert 'Demo signal' in result['limitation']
