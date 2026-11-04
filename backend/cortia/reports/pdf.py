"""PDF report generation for CORTIA Brain Health Monitoring Reports using ReportLab."""
import io
from typing import Any, Dict, List
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PRIMARY_COLOR = HexColor("#24201D")
BRAND_COLOR = HexColor("#9E2A4B")
BRAND_LIGHT = HexColor("#FBF6F6")
ACCENT_MUTED = HexColor("#721F36")
TEXT_MUTED = HexColor("#6E6964")
BORDER_COLOR = HexColor("#E5DFD9")
BG_CARD = HexColor("#FAF8F5")
BG_CALLOUT = HexColor("#F7EAEA")


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to calculate total page count, running headers, footers, and faint watermark."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_watermark_and_chrome(num_pages)
            super().showPage()
        super().save()

    def draw_watermark_and_chrome(self, total_pages: int):
        width, height = letter

        # 1. Diagonal Watermark on every page
        self.saveState()
        self.setFont("Helvetica-Bold", 88)
        # Low opacity faint wine watermark
        self.setFillColor(Color(0.62, 0.16, 0.29, alpha=0.14))
        self.translate(width / 2.0, height / 2.0)
        self.rotate(45)
        self.drawCentredString(0, 0, "CORTIA")
        self.restoreState()

        # 2. Running Header (pages > 1)
        if self._pageNumber > 1:
            self.saveState()
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(BRAND_COLOR)
            self.drawString(46, height - 36, "CORTIA")
            self.setFont("Helvetica", 8)
            self.setFillColor(TEXT_MUTED)
            self.drawString(88, height - 36, "•   Brain Health Monitoring Research Report")

            self.setStrokeColor(BORDER_COLOR)
            self.setLineWidth(0.5)
            self.line(46, height - 42, width - 46, height - 42)
            self.restoreState()

        # 3. Running Footer (all pages)
        self.saveState()
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(46, 44, width - 46, 44)

        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(BRAND_COLOR)
        self.drawString(46, 32, "PRIVATE • RESEARCH USE ONLY")

        self.setFont("Helvetica", 7.5)
        self.setFillColor(TEXT_MUTED)
        self.drawCentredString(width / 2.0, 32, "CORTIA NEUROTECHNOLOGY WORKSTATION")

        page_text = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(width - 46, 32, page_text)
        self.restoreState()


def _get_styles():
    sheet = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=sheet["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=PRIMARY_COLOR,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=sheet["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=TEXT_MUTED,
        spaceAfter=12,
    )
    h1_style = ParagraphStyle(
        "ReportH1",
        parent=sheet["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=BRAND_COLOR,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=sheet["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=PRIMARY_COLOR,
    )
    body_muted = ParagraphStyle(
        "ReportBodyMuted",
        parent=body_style,
        textColor=TEXT_MUTED,
    )
    cell_bold = ParagraphStyle(
        "CellBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    bullet_style = ParagraphStyle(
        "ReportBullet",
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=4,
    )
    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=sheet["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=TEXT_MUTED,
    )
    meta_val = ParagraphStyle(
        "MetaVal",
        parent=sheet["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=PRIMARY_COLOR,
    )
    disclaimer_style = ParagraphStyle(
        "DisclaimerText",
        parent=sheet["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=TEXT_MUTED,
    )

    return {
        "title": title_style,
        "subtitle": subtitle_style,
        "h1": h1_style,
        "body": body_style,
        "body_muted": body_muted,
        "cell_bold": cell_bold,
        "bullet": bullet_style,
        "meta_label": meta_label,
        "meta_val": meta_val,
        "disclaimer": disclaimer_style,
    }


def generate_pdf(report_data: Dict[str, Any]) -> bytes:
    """Builds a complete Brain Health Monitoring PDF report from structured data."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=46,
        rightMargin=46,
        topMargin=48,
        bottomMargin=52,
    )
    styles = _get_styles()
    story = []

    # ==========================================================
    # 1. Report Cover / Header
    # ==========================================================
    header_table_data = [
        [
            Paragraph("<b>CORTIA</b> <font color='#8A8580' size='8'>• NEUROLOGICAL RESEARCH</font>", styles["meta_label"]),
            Paragraph(f"<b>REPORT ID:</b> {report_data['report_id']}", styles["meta_label"]),
        ],
        [
            Paragraph(report_data["report_title"], styles["title"]),
            Paragraph(f"<b>Generated:</b> {report_data['generation_timestamp']}", styles["meta_val"]),
        ],
        [
            Paragraph(report_data["report_subtitle"], styles["subtitle"]),
            Paragraph(f"<b>Subject / Account:</b> {report_data['user']['username']}", styles["meta_val"]),
        ],
    ]
    header_table = Table(header_table_data, colWidths=[340, 180])
    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=4, spaceAfter=8))

    eeg_info = report_data["eeg_analysis"]
    if report_data["report_type"] == "eeg":
        # Focal Session Details metadata strip
        eeg_info = report_data["eeg_analysis"]
        context = eeg_info.get("context", {}) if eeg_info.get("available") else {}
        sess_id_short = eeg_info.get("session_id") or "N/A"
        if sess_id_short != "N/A" and len(sess_id_short) > 16:
            sess_id_short = sess_id_short[:16] + "..."

        meta_cells = [
            [
                Paragraph("<b>RECORDING SESSION</b>", styles["meta_label"]),
                Paragraph("<b>CONDITIONS / EYES</b>", styles["meta_label"]),
                Paragraph("<b>ELECTRODE MONTAGE</b>", styles["meta_label"]),
                Paragraph("<b>QUALITY STATUS</b>", styles["meta_label"]),
            ],
            [
                Paragraph(str(sess_id_short), styles["meta_val"]),
                Paragraph(f"{context.get('task', 'Rest')} • {context.get('eyes', 'N/A')}", styles["meta_val"]),
                Paragraph(str(context.get("montage", "1-Ch Prefrontal")), styles["meta_val"]),
                Paragraph(str(eeg_info.get("quality_verdict", "N/A")), styles["meta_val"]),
            ],
        ]
        meta_table = Table(meta_cells, colWidths=[130, 130, 130, 130])
        meta_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), BG_CARD),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ])
        )
        story.append(meta_table)
        story.append(Spacer(1, 10))

    # ==========================================================
    # 2. Executive Summary
    # ==========================================================
    story.append(Paragraph("Your recording in simple words" if report_data["report_type"] == "eeg" else "Summary and observations", styles["h1"]))

    exec_summary = report_data["executive_summary"]
    obs_paragraphs = []
    for obs in exec_summary["key_observations"]:
        obs_paragraphs.append(Paragraph(f"• &nbsp; {obs}", styles["bullet"]))

    summary_box_data = [[
        obs_paragraphs
    ]]
    summary_box = Table(summary_box_data, colWidths=[520])
    summary_box.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BG_CALLOUT),
            ("BOX", (0, 0), (-1, -1), 1, BRAND_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ])
    )
    story.append(summary_box)
    story.append(Spacer(1, 12))

    pattern = report_data.get("signal_state")
    if pattern:
        story.append(Paragraph("What your signal may suggest", styles["h1"]))
        story.append(Paragraph(f"<b>{pattern['label']}</b>", styles["body"]))
        story.append(Paragraph(pattern['explanation'], styles["body"]))
        for reason in pattern['evidence']:
            story.append(Paragraph(reason, styles["bullet"]))
        story.append(Paragraph(f"<b>Sleep deprivation:</b> {pattern['sleep_deprivation']}", styles["body"]))
        story.append(Paragraph(pattern['limitation'], styles["body_muted"]))
        story.append(Spacer(1, 12))

    if report_data["report_type"] == "eeg":
        # ==========================================================
        # 3. EEG Analysis
        # ==========================================================
        story.append(Paragraph("Wave details and exact numbers", styles["h1"]))

        if eeg_info["available"] and eeg_info.get("valid_windows", 0) > 0:
            # Table of Band Metrics
            band_rows = [
                [
                    Paragraph("<b>Wave type</b>", styles["cell_bold"]),
                    Paragraph("<b>Range</b>", styles["cell_bold"]),
                    Paragraph("<b>Share of signal power</b>", styles["cell_bold"]),
                    Paragraph("<b>Simple explanation</b>", styles["cell_bold"]),
                ]
            ]
            for b_name, b_data in eeg_info["bands"].items():
                rel_pct = f"{b_data['rel'] * 100:.1f}%"
                band_rows.append([
                    Paragraph(f"<b>{b_name}</b>", styles["body"]),
                    Paragraph(b_data["range"], styles["body_muted"]),
                    Paragraph(f"<b>{rel_pct}</b>", styles["body"]),
                    Paragraph(b_data["role"], styles["body"]),
                ])

            band_table = Table(band_rows, colWidths=[90, 85, 95, 250])
            band_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), BG_CARD),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ])
            )
            story.append(band_table)
            story.append(Spacer(1, 8))

            # Chart of Band Power
            if eeg_info.get("chart_png_bytes"):
                chart_img = Image(io.BytesIO(eeg_info["chart_png_bytes"]), width=510, height=175)
                story.append(chart_img)
                story.append(Spacer(1, 8))

            # Ratios & Quality Metrics Strip
            tbr_val = eeg_info["ratios"].get("Theta / Beta Ratio (TBR)")
            tbr_str = f"{tbr_val:.2f}" if tbr_val is not None else "N/A"
            usable_str = f"{eeg_info['valid_windows']} of {eeg_info['valid_windows'] + eeg_info['invalid_windows']} ({eeg_info['usable_pct']}%)"

            metrics_data = [
                [
                    Paragraph("<b>Theta / Beta Ratio (TBR)</b>", styles["meta_label"]),
                    Paragraph("<b>Usable 8-Sec Epochs</b>", styles["meta_label"]),
                    Paragraph("<b>Sample Integrity</b>", styles["meta_label"]),
                    Paragraph("<b>Baseline Comparison</b>", styles["meta_label"]),
                ],
                [
                    Paragraph(tbr_str, styles["meta_val"]),
                    Paragraph(usable_str, styles["meta_val"]),
                    Paragraph(f"{eeg_info['missing_samples']} missing ({eeg_info['missing_rate_pct']}%)", styles["meta_val"]),
                    Paragraph(
                        "Comparison available" if eeg_info["baseline_comparison"].get("available") else "No matching reference",
                        styles["meta_val"],
                    ),
                ],
            ]
            metrics_table = Table(metrics_data, colWidths=[130, 130, 130, 130])
            metrics_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), BG_CARD),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ])
            )
            story.append(metrics_table)
        else:
            story.append(Paragraph("<i>No usable wave results are available for this recording.</i>", styles["body_muted"]))

        story.append(Spacer(1, 14))

    if report_data["report_type"] == "mri":
        # ==========================================================
        # 4. MRI Analysis
        # ==========================================================
        story.append(Paragraph("MRI classification and saliency analysis", styles["h1"]))

        mri_info = report_data["mri_analysis"]
        if mri_info["available"]:
            mri_header_text = (
                f"<b>Uploaded Scan:</b> {mri_info['filename']} &nbsp; | &nbsp; "
                f"<b>Classified As:</b> <font color='#9E2A4B'><b>{mri_info['display_label']}</b></font> "
                f"({mri_info['top_confidence_pct']}% model confidence)"
            )
            story.append(Paragraph(mri_header_text, styles["body"]))
            story.append(Spacer(1, 6))

            # Probability Breakdown Table
            prob_rows = [
                [Paragraph("<b>Pathology Category</b>", styles["cell_bold"]), Paragraph("<b>Model Confidence</b>", styles["cell_bold"])]
            ]
            for cat_name, prob_pct in mri_info["probabilities"].items():
                prob_rows.append([
                    Paragraph(cat_name, styles["body"]),
                    Paragraph(f"<b>{prob_pct:.2f}%</b>", styles["body"]),
                ])

            prob_table = Table(prob_rows, colWidths=[240, 100])
            prob_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), BG_CARD),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ])
            )

            # Images: Scan and Grad-CAM side-by-side or stacked
            img_cells = []
            if mri_info.get("raw_scan_png_bytes"):
                raw_img = Image(io.BytesIO(mri_info["raw_scan_png_bytes"]), width=160, height=160)
                img_cells.append([raw_img, Paragraph("<font size='7.5'>Original Normalized Scan</font>", styles["meta_label"])])
            if mri_info.get("gradcam_png_bytes"):
                cam_img = Image(io.BytesIO(mri_info["gradcam_png_bytes"]), width=160, height=160)
                img_cells.append([cam_img, Paragraph("<font size='7.5'>Grad-CAM Attention Saliency</font>", styles["meta_label"])])

            if img_cells:
                if len(img_cells) == 2:
                    images_layout = Table(
                        [
                            [img_cells[0][0], img_cells[1][0]],
                            [img_cells[0][1], img_cells[1][1]],
                        ],
                        colWidths=[170, 170],
                    )
                else:
                    images_layout = Table([[img_cells[0][0]], [img_cells[0][1]]], colWidths=[170])

                images_layout.setStyle(
                    TableStyle([
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 2),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ])
                )

                mri_compound_table = Table([[images_layout, prob_table]], colWidths=[350, 170])
                mri_compound_table.setStyle(
                    TableStyle([
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ])
                )
                story.append(mri_compound_table)
            else:
                story.append(prob_table)

            # Model limitations
            story.append(Spacer(1, 6))
            lim_paras = [Paragraph(f"• &nbsp; {lim}", styles["bullet"]) for lim in mri_info["limitations"][:3]]
            lim_box = Table([[lim_paras]], colWidths=[520])
            lim_box.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), BG_CARD),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ])
            )
            story.append(lim_box)
        else:
            unavailable_box = Table(
                [[Paragraph("<b>No Cranial MRI Scan Uploaded:</b> Upload high-resolution MRI images in the MRI Analysis workspace for automated 4-class classification and Grad-CAM saliency extraction.", styles["body_muted"])]],
                colWidths=[520],
            )
            unavailable_box.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), BG_CARD),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ])
            )
            story.append(unavailable_box)

        story.append(Spacer(1, 14))

    if report_data["report_type"] == "eeg":
        # ==========================================================
        # 5. Historical Analysis
        # ==========================================================
        story.append(Paragraph("Recording history", styles["h1"]))

        hist_info = report_data["historical_analysis"]
        if hist_info.get("trend_chart_bytes"):
            trend_img = Image(io.BytesIO(hist_info["trend_chart_bytes"]), width=510, height=170)
            story.append(trend_img)
            story.append(Spacer(1, 6))

        if hist_info["sessions_summary"]:
            hist_rows = [
                [
                    Paragraph("<b>Session ID</b>", styles["cell_bold"]),
                    Paragraph("<b>Date</b>", styles["cell_bold"]),
                    Paragraph("<b>Task / Eyes</b>", styles["cell_bold"]),
                    Paragraph("<b>Alpha %</b>", styles["cell_bold"]),
                    Paragraph("<b>Beta %</b>", styles["cell_bold"]),
                    Paragraph("<b>Theta %</b>", styles["cell_bold"]),
                    Paragraph("<b>Valid Windows</b>", styles["cell_bold"]),
                ]
            ]
            for s in hist_info["sessions_summary"]:
                s_short = s["id"][:10] + "..." if len(s["id"]) > 10 else s["id"]
                hist_rows.append([
                    Paragraph(s_short, styles["body"]),
                    Paragraph(s["date"], styles["body_muted"]),
                    Paragraph(f"{s['task']} • {s['eyes']}", styles["body"]),
                    Paragraph(f"{s['alpha']}%", styles["body"]),
                    Paragraph(f"{s['beta']}%", styles["body"]),
                    Paragraph(f"{s['theta']}%", styles["body"]),
                    Paragraph(str(s["valid_windows"]), styles["body"]),
                ])

            hist_table = Table(hist_rows, colWidths=[90, 75, 120, 55, 55, 55, 70])
            hist_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), BG_CARD),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ])
            )
            story.append(hist_table)
        else:
            story.append(Paragraph("<i>Insufficient historical sessions to display longitudinal table.</i>", styles["body_muted"]))

        story.append(Spacer(1, 14))

    # ==========================================================
    # 6. Interpretation and Technical Disclaimer
    # ==========================================================
    story.append(Paragraph("Technical interpretation guide", styles["h1"]))

    interp_rows = [
        [
            Paragraph("<b>Metric</b>", styles["cell_bold"]),
            Paragraph("<b>Measured Value</b>", styles["cell_bold"]),
            Paragraph("<b>Research Interpretation & Physiology</b>", styles["cell_bold"]),
        ]
    ]
    for item in report_data["interpretations"]:
        interp_rows.append([
            Paragraph(f"<b>{item['metric']}</b>", styles["body"]),
            Paragraph(str(item["measurement"]), styles["cell_bold"]),
            Paragraph(item["interpretation"], styles["body"]),
        ])

    interp_table = Table(interp_rows, colWidths=[130, 90, 300])
    interp_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BG_CARD),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(interp_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Research use disclaimer", styles["h1"]))
    disclaimer_table = Table(
        [[Paragraph(report_data["disclaimer"], styles["disclaimer"])]],
        colWidths=[520],
    )
    disclaimer_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BG_CARD),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    story.append(disclaimer_table)

    # Build PDF with custom NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
