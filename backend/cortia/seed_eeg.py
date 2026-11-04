"""Create reproducible demo history using the application's EEG pipeline."""
import argparse
import csv
from datetime import datetime, timedelta, timezone
from uuid import NAMESPACE_URL, uuid5

import numpy as np

from .config import Settings
from .db import setup
from .eeg.processing import analyze, feature_vector
from .models import Feature, Recording, Segment, User
from .analytics.anomalies import quality_events
from .models import Anomaly


CASES = [
    ('Eyes-closed rest', 'closed', (15, 20, 100, 25), None),
    ('Reading', 'open', (12, 25, 35, 85), None),
    ('Quiet rest', 'open', (25, 40, 70, 30), None),
    ('Slow-wave pattern', 'closed', (90, 55, 25, 15), None),
    ('Mixed-band activity', 'open', (45, 45, 45, 45), None),
    ('Interrupted contact', 'open', (20, 30, 75, 35), 'flatline'),
    ('High-amplitude artifact', 'open', (20, 30, 50, 35), 'clipping'),
]


def seed(db, settings, user, anchor=None):
    anchor = anchor or datetime.now(timezone.utc)
    created = []
    for day, (task, eyes, amplitudes, artifact) in enumerate(CASES, 1):
        sid = str(uuid5(NAMESPACE_URL, f'cortia-demo-week-v1:{user.id}:{day}'))
        if db.get(Recording, sid):
            continue
        started = (anchor - timedelta(days=day)).replace(hour=9 + day % 4, minute=day * 7, second=0, microsecond=0)
        fs, windows = 500, 12
        rng = np.random.default_rng(day)
        t = np.arange(fs * 8 * windows) / fs
        samples = 8192 + sum(a * np.sin(2 * np.pi * hz * t) for a, hz in zip(amplitudes, (2, 6, 10, 20)))
        samples += rng.normal(0, 2, len(t))
        if artifact == 'flatline':
            samples[:fs * 8 * 3] = 8192
        elif artifact == 'clipping':
            samples[:fs * 8 * 2] = np.tile([0, 16383], fs * 8)
        samples = np.rint(samples).astype(int)
        path = f'raw/{sid}.csv'
        with (settings.data_dir / path).open('w', newline='') as output:
            writer = csv.writer(output)
            writer.writerow(['sample_index', 'device_counter', 'device_time_seconds', 'received_unix_seconds', 'adc_count', 'missing_before', 'discontinuity'])
            writer.writerows((i, i % 256, i / fs, started.timestamp() + i / fs, int(value), 0, False) for i, value in enumerate(samples))
        row = Recording(id=sid, user_id=user.id, state='completed', started_at=started.isoformat(),
                        ended_at=(started + timedelta(seconds=len(t) / fs)).isoformat(),
                        end_reason='Demo recording completed', context=dict(task=task, eyes=eyes, montage='Fp1-ear', notes='Demo · generated EEG signal'),
                        config=dict(sampling_hz=fs, channel=0, source='demo'), raw_path=path,
                        sample_count=len(t), missing_samples=0, valid_windows=0, invalid_windows=0, features={})
        db.add(row)
        db.flush()
        vectors = []
        for window in range(windows):
            start = window * fs * 8
            result = analyze(samples[start:start + fs * 8], fs)
            result['source'] = 'demo'
            segment = Segment(session_id=sid, start_index=start, end_index=start + fs * 8,
                              created_at=(started + timedelta(seconds=(window + 1) * 8)).isoformat(), result=result)
            db.add(segment)
            db.flush()
            vector = feature_vector(result)
            db.add(Feature(segment_id=segment.id, values=vector))
            if vector:
                row.valid_windows += 1
                vectors.append(vector)
            else:
                row.invalid_windows += 1
                for event in quality_events(result['quality']):
                    db.add(Anomaly(session_id=sid, segment_id=segment.id, created_at=segment.created_at, **event))
        row.features = {key: float(np.mean([v[key] for v in vectors])) for key in vectors[0]} if vectors else {}
        created.append(sid)
    db.commit()
    return created


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--username', required=True)
    args = parser.parse_args()
    settings = Settings()
    engine, factory = setup(settings)
    with factory() as db:
        user = db.query(User).filter_by(username=args.username.lower()).one()
        print(f'Created {len(seed(db, settings, user))} demo recordings.')
    engine.dispose()
