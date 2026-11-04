from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from cortia.main import create_app

from cortia.config import Settings
from cortia.db import setup
from cortia.models import Recording, Segment, User
from cortia.seed_eeg import seed


def test_week_history_calculates_features_and_preserves_provenance(tmp_path):
    settings = Settings(data_dir=tmp_path, testing=True)
    engine, factory = setup(settings)
    anchor = datetime(2026, 11, 2, 12, tzinfo=timezone.utc)
    with factory() as db:
        user = User(username='demo-owner', password_hash='fixture-only')
        db.add(user)
        db.commit()
        assert len(seed(db, settings, user, anchor)) == 7
        assert seed(db, settings, user, anchor) == []
        rows = db.query(Recording).all()
        assert len(rows) == 7
        assert db.query(Segment).count() == 84
        for row in rows:
            age = anchor - datetime.fromisoformat(row.started_at)
            assert 0 < age.total_seconds() <= 7 * 86400
            assert row.config['source'] == 'demo'
            assert row.valid_windows + row.invalid_windows == 12
            assert row.sample_count == 48000
            assert (tmp_path / row.raw_path).is_file()
            assert sum(row.features[f'relative_{band}'] for band in ('alpha', 'beta', 'theta', 'delta')) == pytest.approx(1)
        assert sorted(row.invalid_windows for row in rows) == [0, 0, 0, 0, 0, 2, 3]
        alpha = next(row for row in rows if row.context['task'] == 'Eyes-closed rest')
        assert alpha.features['relative_alpha'] > .8
    engine.dispose()


@pytest.mark.parametrize('count', [3, 4, 7])
def test_demo_baseline_calculates_selected_cases(tmp_path, count):
    with TestClient(create_app(Settings(data_dir=tmp_path, testing=True))) as client:
        account = client.post('/api/auth/register', json={'username': 'baselineowner', 'password': 'valid-password-47'}).json()
        with client.app.state.db() as db:
            user = db.get(User, account['id'])
            ids = seed(db, client.app.state.settings, user)[:count]
            rows = [db.get(Recording, sid) for sid in ids]
            expected = sum(row.features['relative_alpha'] for row in rows) / count
        response = client.post('/api/baselines', json={'session_ids': ids})
        assert response.status_code == 201, response.text
        result = response.json()
        assert result['context']['task'] == 'Demo comparison'
        assert result['statistics']['relative_alpha']['n'] == count
        assert result['statistics']['relative_alpha']['mean'] == pytest.approx(expected)
        assert client.get('/api/baselines').json()[0]['id'] == result['id']


def test_real_baseline_still_rejects_mixed_conditions(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path, testing=True))) as client:
        account = client.post('/api/auth/register', json={'username': 'realowner', 'password': 'valid-password-47'}).json()
        with client.app.state.db() as db:
            ids = seed(db, client.app.state.settings, db.get(User, account['id']))[:3]
            for sid in ids:
                db.get(Recording, sid).config = {'sampling_hz': 500, 'channel': 0}
            db.commit()
        response = client.post('/api/baselines', json={'session_ids': ids})
        assert response.status_code == 422
        assert 'share eyes' in response.json()['detail']
