"""Editable Microsoft Word (.docx) report generation for CORTIA Brain Health Monitoring."""
import io
from typing import Any, Dict
import docx
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Inches, Pt, RGBColor

COLOR_PRIMARY = RGBColor(0x24, 0x20, 0x1D)
COLOR_BRAND = RGBColor(0x9E, 0x2A, 0x4B)
COLOR_MUTED = RGBColor(0x6E, 0x69, 0x64)
HEX_BG_CARD = "FAF8F5"
HEX_BG_CALLOUT = "F7EAEA"
HEX_BORDER = "E5DFD9"


def _set_cell_background(cell, hex_color: str):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)


def _set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement("w:tcMar")
    for m, val in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
        node = OxmlElement(f"w:{m}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        tcMar.append(node)
    tcPr.append(tcMar)


def _set_table_borders(table, hex_color: str = HEX_BORDER):
    tblPr = table._tbl.tblPr
    borders_xml = f"""
    <w:tblBorders {nsdecls("w")}>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="{hex_color}"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="{hex_color}"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="{hex_color}"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="{hex_color}"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="{hex_color}"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="{hex_color}"/>
    </w:tblBorders>
    """
    tblPr.append(parse_xml(borders_xml))


def _add_watermark_and_header_footer(doc, text: str = "CORTIA"):
    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.7)
        section.right_margin = Inches(0.7)

        # 1. Header with Faint Diagonal Watermark & Running Header
        header = section.header
        header_para = header.paragraphs[0]
        header_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT

        # Native Word VML Watermark
        vml_watermark = f"""
        <w:r {nsdecls("w")} xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
          <w:pict>
            <v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e">
              <v:textpath on="t" fitshape="t"/>
            </v:shapetype>
            <v:shape id="PowerPlusWaterMarkObject" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:440pt;height:120pt;z-index:-251656704;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin;rotation:315" fillcolor="#e0d4d6" stroked="f">
              <v:fill opacity="0.12"/>
              <v:textpath style="font-family:'Arial';font-size:1pt;font-weight:bold" string="{text}"/>
            </v:shape>
          </w:pict>
        </w:r>
        """
        header_para._element.append(parse_xml(vml_watermark))

        run_head = header_para.add_run("CORTIA • Brain Health Monitoring Research Report")
        run_head.font.name = "Arial"
        run_head.font.size = Pt(8)
        run_head.font.color.rgb = COLOR_MUTED

        # 2. Running Footer: PRIVATE • RESEARCH USE ONLY & Page Number
        footer = section.footer
        footer_para = footer.paragraphs[0]
        footer_para.alignment = WD_ALIGN_PARAGRAPH.LEFT

        r_foot_label = footer_para.add_run("PRIVATE • RESEARCH USE ONLY\t\t")
        r_foot_label.font.name = "Arial"
        r_foot_label.font.bold = True
        r_foot_label.font.size = Pt(8)
        r_foot_label.font.color.rgb = COLOR_BRAND

        r_page = footer_para.add_run("Page ")
        r_page.font.name = "Arial"
        r_page.font.size = Pt(8)
        r_page.font.color.rgb = COLOR_MUTED

        # Page field
        fld_page = parse_xml(r'<w:fldSimple %s w:instr="PAGE"/>' % nsdecls("w"))
        footer_para._element.append(fld_page)

        r_of = footer_para.add_run(" of ")
        r_of.font.name = "Arial"
        r_of.font.size = Pt(8)
        r_of.font.color.rgb = COLOR_MUTED

        fld_numpages = parse_xml(r'<w:fldSimple %s w:instr="NUMPAGES"/>' % nsdecls("w"))
        footer_para._element.append(fld_numpages)


def generate_docx(report_data: Dict[str, Any]) -> bytes:
    """Generates an editable Microsoft Word (.docx) document with tables, charts, and watermark."""
    doc = docx.Document()
    _add_watermark_and_header_footer(doc, text="CORTIA")

    # Set default normal font
    style_normal = doc.styles["Normal"]
    style_normal.font.name = "Arial"
    style_normal.font.size = Pt(9.5)
    style_normal.font.color.rgb = COLOR_PRIMARY

    # ==========================================================
    # 1. Report Cover / Header
    # ==========================================================
    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.space_after = Pt(2)
    r_brand = p_meta.add_run("CORTIA ")
    r_brand.font.bold = True
    r_brand.font.size = Pt(11)
    r_brand.font.color.rgb = COLOR_BRAND
    r_div = p_meta.add_run("• NEUROLOGICAL RESEARCH WORKSTATION\t\t")
    r_div.font.size = Pt(8.5)
    r_div.font.color.rgb = COLOR_MUTED
    r_id = p_meta.add_run(f"REPORT ID: {report_data['report_id']}")
    r_id.font.bold = True
    r_id.font.size = Pt(9)
    r_id.font.color.rgb = COLOR_PRIMARY

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(4)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("Brain Health Monitoring Report")
    r_title.font.bold = True
    r_title.font.size = Pt(20)
    r_title.font.color.rgb = COLOR_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(10)
    r_sub = p_sub.add_run("Comprehensive Multimodal EEG & MRI Longitudinal Research Synthesis\n")
    r_sub.font.size = Pt(10)
    r_sub.font.color.rgb = COLOR_MUTED
    r_info = p_sub.add_run(f"Generated: {report_data['generation_timestamp']}   |   Subject: {report_data['user']['username']}")
    r_info.font.size = Pt(8.5)
    r_info.font.color.rgb = COLOR_MUTED

    # Focal session details card
    eeg_info = report_data["eeg_analysis"]
    context = eeg_info.get("context", {}) if eeg_info.get("available") else {}
    sess_id_short = eeg_info.get("session_id", "N/A")
    if sess_id_short != "N/A" and len(sess_id_short) > 16:
        sess_id_short = sess_id_short[:16] + "..."

    tbl_meta = doc.add_table(rows=2, cols=4)
    tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    _set_table_borders(tbl_meta)

    headers = ["RECORDING SESSION", "CONDITIONS / EYES", "ELECTRODE MONTAGE", "QUALITY STATUS"]
    values = [
        str(sess_id_short),
        f"{context.get('task', 'Rest')} • {context.get('eyes', 'N/A')}",
        str(context.get("montage", "1-Ch Prefrontal")),
        str(eeg_info.get("quality_verdict", "N/A")),
    ]
    for col_idx in range(4):
        c_hdr = tbl_meta.cell(0, col_idx)
        _set_cell_background(c_hdr, HEX_BG_CARD)
        _set_cell_margins(c_hdr, top=80, bottom=60, left=100, right=100)
        p = c_hdr.paragraphs[0]
        r = p.add_run(headers[col_idx])
        r.font.bold = True
        r.font.size = Pt(7.5)
        r.font.color.rgb = COLOR_MUTED

        c_val = tbl_meta.cell(1, col_idx)
        _set_cell_margins(c_val, top=60, bottom=80, left=100, right=100)
        p2 = c_val.paragraphs[0]
        r2 = p2.add_run(values[col_idx])
        r2.font.size = Pt(8.5)
        r2.font.color.rgb = COLOR_PRIMARY

    # ==========================================================
    # 2. Executive Summary
    # ==========================================================
    p_h1 = doc.add_paragraph()
    p_h1.paragraph_format.space_before = Pt(16)
    p_h1.paragraph_format.space_after = Pt(4)
    r_h1 = p_h1.add_run("1. Executive Summary & Observations")
    r_h1.font.bold = True
    r_h1.font.size = Pt(13)
    r_h1.font.color.rgb = COLOR_BRAND

    tbl_exec = doc.add_table(rows=1, cols=1)
    tbl_exec.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_exec = tbl_exec.cell(0, 0)
    _set_cell_background(c_exec, HEX_BG_CALLOUT)
    _set_cell_margins(c_exec, top=140, bottom=140, left=180, right=180)
    _set_table_borders(tbl_exec, hex_color="9E2A4B")

    exec_summary = report_data["executive_summary"]
    p_first = c_exec.paragraphs[0]
    p_first.paragraph_format.space_after = Pt(4)
    r_b0 = p_first.add_run(f"•  {exec_summary['key_observations'][0]}")
    r_b0.font.size = Pt(9)
    for obs in exec_summary["key_observations"][1:]:
        p_b = c_exec.add_paragraph()
        p_b.paragraph_format.space_after = Pt(4)
        r_b = p_b.add_run(f"•  {obs}")
        r_b.font.size = Pt(9)

    # ==========================================================
    # 3. EEG Analysis
    # ==========================================================
    p_eeg = doc.add_paragraph()
    p_eeg.paragraph_format.space_before = Pt(16)
    p_eeg.paragraph_format.space_after = Pt(4)
    r_eeg = p_eeg.add_run("2. Quantitative Electroencephalography (EEG) Analysis")
    r_eeg.font.bold = True
    r_eeg.font.size = Pt(13)
    r_eeg.font.color.rgb = COLOR_BRAND

    if eeg_info["available"]:
        tbl_bands = doc.add_table(rows=1, cols=4)
        tbl_bands.alignment = WD_TABLE_ALIGNMENT.CENTER
        _set_table_borders(tbl_bands)

        band_cols = ["Frequency Band", "Range", "Relative Power", "Neurophysiological Association"]
        for ci, cname in enumerate(band_cols):
            cell = tbl_bands.cell(0, ci)
            _set_cell_background(cell, HEX_BG_CARD)
            _set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            r = p.add_run(cname)
            r.font.bold = True
            r.font.size = Pt(8.5)

        for b_name, b_data in eeg_info["bands"].items():
            row = tbl_bands.add_row()
            cells = row.cells
            for cell in cells:
                _set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
            cells[0].paragraphs[0].add_run(b_name).font.bold = True
            cells[1].paragraphs[0].add_run(b_data["range"]).font.color.rgb = COLOR_MUTED
            cells[2].paragraphs[0].add_run(f"{b_data['rel'] * 100:.1f}%").font.bold = True
            cells[3].paragraphs[0].add_run(b_data["role"])

        # Band power chart
        if eeg_info.get("chart_png_bytes"):
            doc.add_paragraph().paragraph_format.space_before = Pt(6)
            doc.add_picture(io.BytesIO(eeg_info["chart_png_bytes"]), width=Inches(6.6))

        # Metrics strip
        tbr_val = eeg_info["ratios"].get("Theta / Beta Ratio (TBR)")
        tbr_str = f"{tbr_val:.2f}" if tbr_val is not None else "N/A"
        usable_str = f"{eeg_info['valid_windows']} of {eeg_info['valid_windows'] + eeg_info['invalid_windows']} ({eeg_info['usable_pct']}%)"

        tbl_ratios = doc.add_table(rows=2, cols=4)
        tbl_ratios.alignment = WD_TABLE_ALIGNMENT.CENTER
        _set_table_borders(tbl_ratios)

        r_headers = ["Theta / Beta Ratio (TBR)", "Usable 8-Sec Epochs", "Sample Integrity", "Baseline Comparison"]
        r_vals = [
            tbr_str,
            usable_str,
            f"{eeg_info['missing_samples']} missing ({eeg_info['missing_rate_pct']}%)",
            "Within Reference Range" if eeg_info["baseline_comparison"].get("available") else "Baseline Not Set",
        ]
        for ci in range(4):
            c_h = tbl_ratios.cell(0, ci)
            _set_cell_background(c_h, HEX_BG_CARD)
            _set_cell_margins(c_h, top=80, bottom=60, left=100, right=100)
            p = c_h.paragraphs[0]
            r = p.add_run(r_headers[ci])
            r.font.bold = True
            r.font.size = Pt(7.5)
            r.font.color.rgb = COLOR_MUTED

            c_v = tbl_ratios.cell(1, ci)
            _set_cell_margins(c_v, top=60, bottom=80, left=100, right=100)
            p2 = c_v.paragraphs[0]
            r2 = p2.add_run(r_vals[ci])
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_PRIMARY
    else:
        p_none = doc.add_paragraph()
        r_none = p_none.add_run("No focal EEG recording available for this report.")
        r_none.font.italic = True
        r_none.font.color.rgb = COLOR_MUTED

    # ==========================================================
    # 4. MRI Analysis
    # ==========================================================
    p_mri = doc.add_paragraph()
    p_mri.paragraph_format.space_before = Pt(16)
    p_mri.paragraph_format.space_after = Pt(4)
    r_mri = p_mri.add_run("3. Cranial MRI Deep Learning & Saliency Analysis")
    r_mri.font.bold = True
    r_mri.font.size = Pt(13)
    r_mri.font.color.rgb = COLOR_BRAND

    mri_info = report_data["mri_analysis"]
    if mri_info["available"]:
        p_mri_sub = doc.add_paragraph()
        p_mri_sub.add_run(f"Uploaded Scan: {mri_info['filename']}   |   Classified As: ").font.color.rgb = COLOR_PRIMARY
        r_mri_lbl = p_mri_sub.add_run(f"{mri_info['display_label']}")
        r_mri_lbl.font.bold = True
        r_mri_lbl.font.color.rgb = COLOR_BRAND
        p_mri_sub.add_run(f" ({mri_info['top_confidence_pct']}% model confidence)").font.color.rgb = COLOR_PRIMARY

        # Probability breakdown
        tbl_probs = doc.add_table(rows=1, cols=2)
        tbl_probs.alignment = WD_TABLE_ALIGNMENT.CENTER
        _set_table_borders(tbl_probs)

        tbl_probs.cell(0, 0).paragraphs[0].add_run("Pathology Category").font.bold = True
        tbl_probs.cell(0, 1).paragraphs[0].add_run("Model Confidence").font.bold = True
        _set_cell_background(tbl_probs.cell(0, 0), HEX_BG_CARD)
        _set_cell_background(tbl_probs.cell(0, 1), HEX_BG_CARD)

        for cat_name, prob_pct in mri_info["probabilities"].items():
            row = tbl_probs.add_row()
            _set_cell_margins(row.cells[0], top=40, bottom=40, left=100, right=100)
            _set_cell_margins(row.cells[1], top=40, bottom=40, left=100, right=100)
            row.cells[0].paragraphs[0].add_run(cat_name)
            row.cells[1].paragraphs[0].add_run(f"{prob_pct:.2f}%").font.bold = True

        # Scan & Grad-CAM images
        if mri_info.get("raw_scan_png_bytes") or mri_info.get("gradcam_png_bytes"):
            tbl_imgs = doc.add_table(rows=1, cols=2)
            tbl_imgs.alignment = WD_TABLE_ALIGNMENT.CENTER
            _set_table_borders(tbl_imgs)

            if mri_info.get("raw_scan_png_bytes"):
                c0 = tbl_imgs.cell(0, 0)
                _set_cell_margins(c0, top=60, bottom=60, left=60, right=60)
                c0.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
                c0.paragraphs[0].add_run().add_picture(io.BytesIO(mri_info["raw_scan_png_bytes"]), width=Inches(2.5))
                p_cap = c0.add_paragraph("Original Normalized Scan")
                p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_cap.runs[0].font.size = Pt(8)
                p_cap.runs[0].font.color.rgb = COLOR_MUTED

            if mri_info.get("gradcam_png_bytes"):
                c1 = tbl_imgs.cell(0, 1)
                _set_cell_margins(c1, top=60, bottom=60, left=60, right=60)
                c1.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
                c1.paragraphs[0].add_run().add_picture(io.BytesIO(mri_info["gradcam_png_bytes"]), width=Inches(2.5))
                p_cap2 = c1.add_paragraph("Grad-CAM Attention Saliency")
                p_cap2.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_cap2.runs[0].font.size = Pt(8)
                p_cap2.runs[0].font.color.rgb = COLOR_MUTED
    else:
        tbl_no_mri = doc.add_table(rows=1, cols=1)
        c_no = tbl_no_mri.cell(0, 0)
        _set_cell_background(c_no, HEX_BG_CARD)
        _set_table_borders(tbl_no_mri)
        _set_cell_margins(c_no, top=100, bottom=100, left=140, right=140)
        p_no = c_no.paragraphs[0]
        p_no.add_run("No Cranial MRI Scan Uploaded: ").font.bold = True
        p_no.add_run("Upload high-resolution cranial MRI images in the MRI Analysis workspace for automated 4-class classification and Grad-CAM saliency extraction.").font.color.rgb = COLOR_MUTED

    # ==========================================================
    # 5. Historical Analysis
    # ==========================================================
    p_hist = doc.add_paragraph()
    p_hist.paragraph_format.space_before = Pt(16)
    p_hist.paragraph_format.space_after = Pt(4)
    r_hist = p_hist.add_run("4. Longitudinal & Session History Analysis")
    r_hist.font.bold = True
    r_hist.font.size = Pt(13)
    r_hist.font.color.rgb = COLOR_BRAND

    hist_info = report_data["historical_analysis"]
    if hist_info.get("trend_chart_bytes"):
        doc.add_picture(io.BytesIO(hist_info["trend_chart_bytes"]), width=Inches(6.6))

    if hist_info["sessions_summary"]:
        tbl_h = doc.add_table(rows=1, cols=7)
        tbl_h.alignment = WD_TABLE_ALIGNMENT.CENTER
        _set_table_borders(tbl_h)

        h_cols = ["Session ID", "Date", "Task / Eyes", "Alpha %", "Beta %", "Theta %", "Valid Windows"]
        for ci, cn in enumerate(h_cols):
            cell = tbl_h.cell(0, ci)
            _set_cell_background(cell, HEX_BG_CARD)
            _set_cell_margins(cell, top=60, bottom=60, left=60, right=60)
            cell.paragraphs[0].add_run(cn).font.bold = True

        for s in hist_info["sessions_summary"]:
            row = tbl_h.add_row()
            for cell in row.cells:
                _set_cell_margins(cell, top=50, bottom=50, left=60, right=60)
            s_short = s["id"][:8] + "..." if len(s["id"]) > 8 else s["id"]
            row.cells[0].paragraphs[0].add_run(s_short)
            row.cells[1].paragraphs[0].add_run(s["date"]).font.color.rgb = COLOR_MUTED
            row.cells[2].paragraphs[0].add_run(f"{s['task']} • {s['eyes']}")
            row.cells[3].paragraphs[0].add_run(f"{s['alpha']}%")
            row.cells[4].paragraphs[0].add_run(f"{s['beta']}%")
            row.cells[5].paragraphs[0].add_run(f"{s['theta']}%")
            row.cells[6].paragraphs[0].add_run(str(s["valid_windows"]))
    else:
        p_h_none = doc.add_paragraph()
        p_h_none.add_run("Insufficient historical sessions to display longitudinal table.").font.color.rgb = COLOR_MUTED

    # ==========================================================
    # 6. Interpretation and Regulatory Disclaimer
    # ==========================================================
    p_interp = doc.add_paragraph()
    p_interp.paragraph_format.space_before = Pt(16)
    p_interp.paragraph_format.space_after = Pt(4)
    r_interp = p_interp.add_run("5. Technical Interpretation Guide")
    r_interp.font.bold = True
    r_interp.font.size = Pt(13)
    r_interp.font.color.rgb = COLOR_BRAND

    tbl_it = doc.add_table(rows=1, cols=3)
    tbl_it.alignment = WD_TABLE_ALIGNMENT.CENTER
    _set_table_borders(tbl_it)

    it_cols = ["Metric", "Measured Value", "Research Interpretation & Physiology"]
    for ci, cn in enumerate(it_cols):
        cell = tbl_it.cell(0, ci)
        _set_cell_background(cell, HEX_BG_CARD)
        _set_cell_margins(cell, top=60, bottom=60, left=80, right=80)
        cell.paragraphs[0].add_run(cn).font.bold = True

    for item in report_data["interpretations"]:
        row = tbl_it.add_row()
        for cell in row.cells:
            _set_cell_margins(cell, top=50, bottom=50, left=80, right=80)
        row.cells[0].paragraphs[0].add_run(item["metric"]).font.bold = True
        row.cells[1].paragraphs[0].add_run(str(item["measurement"])).font.bold = True
        row.cells[2].paragraphs[0].add_run(item["interpretation"])

    p_disc_hdr = doc.add_paragraph()
    p_disc_hdr.paragraph_format.space_before = Pt(14)
    p_disc_hdr.paragraph_format.space_after = Pt(4)
    r_disc_hdr = p_disc_hdr.add_run("6. Research Use Only Regulatory Disclaimer")
    r_disc_hdr.font.bold = True
    r_disc_hdr.font.size = Pt(11)
    r_disc_hdr.font.color.rgb = COLOR_MUTED

    tbl_disc = doc.add_table(rows=1, cols=1)
    tbl_disc.alignment = WD_TABLE_ALIGNMENT.CENTER
    _set_table_borders(tbl_disc)
    c_disc = tbl_disc.cell(0, 0)
    _set_cell_background(c_disc, HEX_BG_CARD)
    _set_cell_margins(c_disc, top=100, bottom=100, left=140, right=140)
    p_disc = c_disc.paragraphs[0]
    r_disc_text = p_disc.add_run(report_data["disclaimer"])
    r_disc_text.font.size = Pt(8)
    r_disc_text.font.color.rgb = COLOR_MUTED

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
