import io
import zipfile

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from cortia.config import Settings
from cortia.main import create_app
from cortia.models import MRIUpload, MRIPrediction, Recording
from cortia.reports.builder import build_report_data
from cortia.models import User


@pytest.fixture
def reports_client(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path, testing=True))) as client:
        user = client.post('/api/auth/register', json={'username': 'reportowner', 'password': 'valid-password-47'}).json()
        with client.app.state.db() as db:
            db.add(Recording(id='eeg-one', user_id=user['id'], state='completed',
                            context={'task': 'Rest', 'eyes': 'closed', 'montage': 'Fp1-ear'},
                            config={'sampling_hz': 500, 'channel': 0, 'source': 'demo'}, raw_path='raw/fixture.csv',
                            valid_windows=12, invalid_windows=0, sample_count=48000,
                            features={'relative_alpha': .7, 'relative_beta': .1, 'relative_theta': .1, 'relative_delta': .1}))
            db.add(Recording(id='eeg-two', user_id=user['id'], state='completed',
                            started_at='2026-10-30T10:15:00+00:00', ended_at='2026-10-30T10:15:32+00:00',
                            context={'task': 'Reading', 'eyes': 'open', 'montage': 'Fp1-ear'},
                            config={'sampling_hz': 250, 'channel': 0}, raw_path='raw/second.csv',
                            valid_windows=3, invalid_windows=1, sample_count=8000,
                            features={'relative_alpha': .1, 'relative_beta': .8, 'relative_theta': .05, 'relative_delta': .05}))
            Image.new('RGB', (64, 64)).save(tmp_path / 'mri/scan.png')
            for mid, created, label in [('older-scan', '2026-10-29T12:00:00+00:00', 'glioma_tumor'), ('newer-scan', '2026-11-01T12:00:00+00:00', 'no_tumor')]:
                db.add(MRIUpload(id=mid, user_id=user['id'], filename=mid, private_path='mri/scan.png', sha256='fixture', created_at=created))
                db.flush()
                db.add(MRIPrediction(upload_id=mid, result={'label': label, 'probabilities': {label: 1.0}, 'explainability': {'available': False}, 'limitations': ['Research only']}))
            db.commit()
        yield client


@pytest.mark.parametrize('path', ['/api/sessions/eeg-one/report', '/api/mri/older-scan/report'])
@pytest.mark.parametrize('format', ['pdf', 'docx'])
def test_watermarked_document_downloads(reports_client, path, format):
    response = reports_client.get(path, params={'format': format})
    assert response.status_code == 200, response.text[:500] if response.status_code != 200 else ''
    assert 'attachment;' in response.headers['content-disposition']
    assert response.headers['cache-control'] == 'no-store'
    if format == 'pdf':
        assert response.content.startswith(b'%PDF-')
        assert b'/ca .14' in response.content
        assert len(response.content) > 1000
    else:
        with zipfile.ZipFile(io.BytesIO(response.content)) as document:
            header = document.read('word/header1.xml').decode()
            assert 'PowerPlusWaterMarkObject' in header
            assert 'string="CORTIA"' in header
            assert 'rotation:315' in header
            assert 'opacity="0.32"' in header
            assert 'word/document.xml' in document.namelist()
            text = document.read('word/document.xml').decode()
            if '/mri/' in path:
                assert 'MRI Analysis Report' in text
                assert 'EEG' not in text
                assert 'eeg-one' not in text
            else:
                assert 'EEG Signal Analysis Report' in text
                assert 'MRI' not in text
                assert 'older-scan' not in text


def test_mri_report_uses_selected_scan(reports_client):
    with reports_client.app.state.db() as db:
        user = db.query(User).filter_by(username='reportowner').one()
        report = build_report_data(db, user, reports_client.app.state.settings, mri_id='older-scan', report_type='mri')
        assert report['mri_analysis']['upload_id'] == 'older-scan'
        assert report['mri_analysis']['label'] == 'glioma_tumor'


def test_other_account_cannot_download_reports(reports_client):
    reports_client.post('/api/auth/logout')
    reports_client.post('/api/auth/register', json={'username': 'otherowner', 'password': 'valid-password-48'})
    for path in ('/api/sessions/eeg-one/report', '/api/mri/older-scan/report'):
        assert reports_client.get(path, params={'format': 'pdf'}).status_code == 404


def test_eeg_reports_explain_the_selected_recording(reports_client):
    texts = []
    for sid in ('eeg-one', 'eeg-two'):
        response = reports_client.get(f'/api/sessions/{sid}/report?format=docx')
        assert response.status_code == 200
        with zipfile.ZipFile(io.BytesIO(response.content)) as document:
            texts.append(document.read('word/document.xml').decode())
    first, second = texts
    assert 'Alpha waves had the largest share of signal power: 70.0%' in first
    assert 'Beta waves had the largest share of signal power: 80.0%' in second
    assert '96.0 seconds' in first
    assert '32.0 seconds' in second
    assert '3 sections were clear enough to use. 1 section was left out' in second
    assert 'eeg-two' not in first
    assert 'eeg-one' not in second
    assert 'Gamma' not in first + second
    assert 'Optimal Research Grade' not in first + second
    assert 'What your signal may suggest' in first
    assert 'Possible relaxed or resting pattern' in first
    assert 'Possible alert or engaged pattern' in second
    assert 'Sleep deprivation:' in first + second


def test_unusable_recording_does_not_invent_a_wave_result(reports_client):
    with reports_client.app.state.db() as db:
        row = db.get(Recording, 'eeg-two')
        row.valid_windows = 0
        row.invalid_windows = 4
        row.features = {}
        db.commit()
    response = reports_client.get('/api/sessions/eeg-two/report?format=docx')
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as document:
        text = document.read('word/document.xml').decode()
        assert 'not enough usable signal' in text
        assert 'largest share' not in text
