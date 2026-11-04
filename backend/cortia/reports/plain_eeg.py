"""Recording-specific explanations without inferring health or mental state."""


def explain_recording(recording, eeg):
    if recording is None:
        return ['No EEG recording has been saved yet. Record a signal before downloading an analysis.']
    fs = recording.config.get('sampling_hz', 0)
    duration = recording.sample_count / fs if fs else None
    source = 'demo signal' if recording.config.get('source') == 'demo' else 'recorded EEG signal'
    lines = [f'This report describes one {source}. Its recording ID is {recording.id}.',
             f'The recording started on {eeg["started_at"]}.']
    if duration is not None:
        lines.append(f'It contains {duration:.1f} seconds of saved signal.')
    lines.append(f'The activity was {recording.context.get("task", "not specified")}. The eyes were {recording.context.get("eyes", "not specified")}.')
    if recording.state == 'recording':
        lines.append('Recording is still in progress. This report covers saved data only. Stop recording for the final report.')
    total = recording.valid_windows + recording.invalid_windows
    if total:
        lines.append(f'The signal was checked in {total} short sections. Each section lasts eight seconds.')
        usable = '1 section was' if recording.valid_windows == 1 else f'{recording.valid_windows} sections were'
        excluded = '1 section was' if recording.invalid_windows == 1 else f'{recording.invalid_windows} sections were'
        lines.append(f'{usable} clear enough to use. {excluded} left out because of signal problems.')
    bands = {name: values['rel'] for name, values in eeg['bands'].items()}
    if not recording.valid_windows or not bands or not any(bands.values()):
        lines.append('There is not enough usable signal to explain the wave pattern. The report does not estimate missing results.')
    else:
        ordered = sorted(bands.items(), key=lambda item: item[1], reverse=True)
        leader, power = ordered[0]
        tied = len(ordered) > 1 and abs(power - ordered[1][1]) < .01
        if tied:
            lines.append(f'{leader} and {ordered[1][0]} had similar shares of signal power. No single wave type clearly stood out.')
        else:
            lines.append(f'{leader} waves had the largest share of signal power: {power * 100:.1f}%.')
        lines.append('The signal contains a mix of slower and faster waves. The percentages below show their shares of signal power.')
        lines.append('See the signal-pattern section below for possible links to rest, alertness, or drowsiness. These links do not confirm your actual state.')
    if recording.missing_samples:
        lines.append(f'{recording.missing_samples} samples were missing. Gaps can make the signal harder to interpret.')
    baseline = eeg['baseline_comparison']
    if baseline.get('available'):
        flagged = sum(bool(value.get('flagged')) for value in baseline.get('deviations', {}).values())
        lines.append(f'{flagged} values differ by the software comparison rule from your saved reference.' if flagged else 'No values crossed the software comparison limit for your saved reference.')
        lines.append('This comparison shows a change in recorded values. It does not identify a medical condition.')
    else:
        lines.append('No matching personal reference is available. This report does not say whether your signal has changed from usual.')
    lines.append('These results describe the recorded signal only. They are not a medical diagnosis.')
    return lines
