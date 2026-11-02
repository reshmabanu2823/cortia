import io
import zipfile
import pytest
from fastapi.testclient import TestClient
from cortia.main import create_app
from cortia.config import Settings
from cortia.models import Recording, MRIUpload, MRIPrediction, Report
from cortia.reports.builder import build_report_data
from cortia.reports.pdf import generate_pdf
from cortia.reports.docx import generate_docx
from test_api import signup


def sample_context():
    return {"eyes": "closed", "task": "rest", "montage": "Fp1-ear", "notes": "Test recording"}


def insert_test_recording(app, user_id, valid_w=5):
    with app.state.db() as db:
        rec = Recording(
            user_id=user_id,
            state="completed",
            context=sample_context(),
            config={"sampling_hz": 250},
            raw_path="raw/test.csv",
            sample_count=10000,
            missing_samples=2,
            valid_windows=valid_w,
            invalid_windows=1,
            features={
                "relative_delta": 0.15,
                "relative_theta": 0.20,
                "relative_alpha": 0.40,
                "relative_beta": 0.22,
                "relative_gamma": 0.03,
            },
        )
        db.add(rec)
        db.commit()
        return rec.id


def insert_test_mri(app, user_id):
    with app.state.db() as db:
        upload = MRIUpload(
            user_id=user_id,
            filename="test_scan.png",
            private_path="mri/test_scan.png",
            sha256="abcd" * 16,
        )
        db.add(upload)
        db.flush()
        pred = MRIPrediction(
            upload_id=upload.id,
            result={
                "label": "no_tumor",
                "probabilities": {
                    "no_tumor": 0.965,
                    "glioma_tumor": 0.015,
                    "meningioma_tumor": 0.012,
                    "pituitary_tumor": 0.008,
                },
                "explainability": {"available": False},
                "limitations": ["Exploratory model; research support only."],
            },
        )
        db.add(pred)
        db.commit()
        return upload.id


def test_build_report_data_structures(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, testing=True))
    with TestClient(app) as client:
        user = signup(client, "report_user")
        sid = insert_test_recording(app, user["id"])
        insert_test_mri(app, user["id"])

        with app.state.db() as db:
            from cortia.models import User
            user_row = db.get(User, user["id"])
            report_dict = build_report_data(db, user_row, app.state.settings, session_id=sid)

        assert report_dict["report_id"].startswith("REP-")
        assert report_dict["user"]["username"] == "report_user"
        assert report_dict["eeg_analysis"]["available"] is True
        assert report_dict["eeg_analysis"]["bands"]["Alpha"]["rel"] == 0.40
        assert report_dict["mri_analysis"]["available"] is True
        assert report_dict["mri_analysis"]["display_label"] == "No Tumor Detected"
        assert len(report_dict["executive_summary"]["key_observations"]) >= 2
        assert len(report_dict["interpretations"]) >= 5


def test_pdf_generation_content_and_watermark(tmp_path):
    import reportlab.rl_config
    orig_comp = reportlab.rl_config.pageCompression
    try:
        reportlab.rl_config.pageCompression = 0
        app = create_app(Settings(data_dir=tmp_path, testing=True))
        with TestClient(app) as client:
            user = signup(client, "pdf_user")
            sid = insert_test_recording(app, user["id"])

            with app.state.db() as db:
                from cortia.models import User
                user_row = db.get(User, user["id"])
                report_dict = build_report_data(db, user_row, app.state.settings, session_id=sid)

            pdf_bytes = generate_pdf(report_dict)
            assert len(pdf_bytes) > 5000
            assert pdf_bytes.startswith(b"%PDF-")
            # Ensure watermark & footer string appear in generated stream
            assert b"PRIVATE" in pdf_bytes or b"CORTIA" in pdf_bytes
    finally:
        reportlab.rl_config.pageCompression = orig_comp


def test_docx_generation_structure_and_watermark(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, testing=True))
    with TestClient(app) as client:
        user = signup(client, "docx_user")
        sid = insert_test_recording(app, user["id"])

        with app.state.db() as db:
            from cortia.models import User
            user_row = db.get(User, user["id"])
            report_dict = build_report_data(db, user_row, app.state.settings, session_id=sid)

        docx_bytes = generate_docx(report_dict)
        assert len(docx_bytes) > 5000

        # Validate that it is a valid zip package containing word/document.xml
        zf = zipfile.ZipFile(io.BytesIO(docx_bytes))
        doc_xml = zf.read("word/document.xml").decode("utf-8")
        assert "Brain Health Monitoring Report" in doc_xml
        assert "Executive Summary" in doc_xml

        # Check watermark presence in header
        headers = [f for f in zf.namelist() if f.startswith("word/header")]
        assert len(headers) > 0
        header_xml = zf.read(headers[0]).decode("utf-8")
        assert "PowerPlusWaterMarkObject" in header_xml or "CORTIA" in header_xml

        # Check footer
        footers = [f for f in zf.namelist() if f.startswith("word/footer")]
        assert len(footers) > 0
        footer_xml = zf.read(footers[0]).decode("utf-8")
        assert "PRIVATE" in footer_xml or "RESEARCH USE ONLY" in footer_xml


def test_api_session_report_formats(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, testing=True))
    with TestClient(app) as client:
        user = signup(client, "api_report_user")
        sid = insert_test_recording(app, user["id"])

        # 1. JSON (legacy format preserved)
        r_json = client.get(f"/api/sessions/{sid}/report?format=json")
        assert r_json.status_code == 200
        assert r_json.headers["content-type"].startswith("application/json")
        body = r_json.json()
        assert body["product"] == "CORTIA"
        assert body["session"]["id"] == sid

        # 2. PDF
        r_pdf = client.get(f"/api/sessions/{sid}/report?format=pdf")
        assert r_pdf.status_code == 200
        assert r_pdf.headers["content-type"] == "application/pdf"
        assert "attachment" in r_pdf.headers["content-disposition"]
        assert f"cortia-{sid}-brain-health-report.pdf" in r_pdf.headers["content-disposition"]
        assert r_pdf.content.startswith(b"%PDF-")

        # 3. DOCX
        r_docx = client.get(f"/api/sessions/{sid}/report?format=docx")
        assert r_docx.status_code == 200
        assert "openxmlformats" in r_docx.headers["content-type"]
        assert "attachment" in r_docx.headers["content-disposition"]
        assert f"cortia-{sid}-brain-health-report.docx" in r_docx.headers["content-disposition"]
        assert len(r_docx.content) > 1000

        # Check DB audit records in Report table
        with app.state.db() as db:
            reports = db.query(Report).filter_by(session_id=sid).all()
            formats = {rep.format for rep in reports}
            assert "json" in formats
            assert "pdf" in formats
            assert "docx" in formats


def test_api_brain_health_report_endpoint(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, testing=True))
    with TestClient(app) as client:
        user = signup(client, "overall_user")
        sid = insert_test_recording(app, user["id"])

        # Endpoint with default format=pdf
        r_pdf = client.get("/api/reports/brain-health?format=pdf")
        assert r_pdf.status_code == 200
        assert r_pdf.headers["content-type"] == "application/pdf"

        # Endpoint with format=docx
        r_docx = client.get("/api/reports/brain-health?format=docx")
        assert r_docx.status_code == 200
        assert "openxmlformats" in r_docx.headers["content-type"]
