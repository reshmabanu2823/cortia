"""Chart generation using Pillow for standalone, cross-platform report embedding."""
import io
import math
from typing import Dict, List, Optional
from PIL import Image, ImageDraw, ImageFont


def _load_font(size: int, bold: bool = False):
    try:
        # Standard Windows fonts
        font_name = "arialbd.ttf" if bold else "arial.ttf"
        return ImageFont.truetype(font_name, size)
    except Exception:
        try:
            font_name = "segoeuib.ttf" if bold else "segoeui.ttf"
            return ImageFont.truetype(font_name, size)
        except Exception:
            return ImageFont.load_default()


BAND_COLORS = {
    "Delta": "#5C768D",
    "Theta": "#7B6291",
    "Alpha": "#9E2A4B",  # CORTIA wine accent
    "Beta": "#2E7D73",
    "Gamma": "#C26D3F",
}

BAND_RANGES = {
    "Delta": "0.5 - 4.0 Hz",
    "Theta": "4.0 - 8.0 Hz",
    "Alpha": "8.0 - 13.0 Hz",
    "Beta": "13.0 - 30.0 Hz",
    "Gamma": "30.0 - 45.0 Hz",
}


def render_band_power_chart(bands: Dict[str, float], width: int = 680, height: int = 240) -> bytes:
    """Render horizontal bar chart for relative band power distribution."""
    img = Image.new("RGB", (width, height), color="#FAFAF8")
    draw = ImageDraw.Draw(img)

    # Frame border
    draw.rounded_rectangle([(1, 1), (width - 2, height - 2)], radius=6, outline="#E8E2DD", width=1)

    font_title = _load_font(13, bold=True)
    font_label = _load_font(11, bold=True)
    font_meta = _load_font(10, bold=False)
    font_val = _load_font(11, bold=True)

    # Header title
    draw.text((24, 16), "Relative Band Power Distribution (PSD)", fill="#24201D", font=font_title)
    draw.text((width - 220, 18), "Proportion of Total Spectral Energy", fill="#8A8580", font=font_meta)

    # Top separator line
    draw.line([(24, 42), (width - 24, 42)], fill="#EFEAE6", width=1)

    band_keys = ["Delta", "Theta", "Alpha", "Beta", "Gamma"]
    start_y = 54
    bar_height = 20
    row_spacing = 34
    bar_start_x = 180
    max_bar_width = width - bar_start_x - 90

    for idx, name in enumerate(band_keys):
        val = max(0.0, min(1.0, float(bands.get(name.lower(), 0.0))))
        y = start_y + idx * row_spacing
        color = BAND_COLORS.get(name, "#666666")
        freq = BAND_RANGES.get(name, "")

        # Label + freq range
        draw.text((24, y + 2), name, fill="#24201D", font=font_label)
        draw.text((80, y + 3), freq, fill="#8A8580", font=font_meta)

        # Track background
        draw.rounded_rectangle(
            [(bar_start_x, y), (bar_start_x + max_bar_width, y + bar_height)],
            radius=4,
            fill="#EFECE8",
        )

        # Filled bar
        bar_w = int(max_bar_width * val)
        if bar_w > 0:
            fill_rect = [(bar_start_x, y), (bar_start_x + bar_w, y + bar_height)]
            draw.rounded_rectangle(fill_rect, radius=4, fill=color)

        # Value text percentage
        pct_text = f"{val * 100:.1f}%"
        draw.text((bar_start_x + max_bar_width + 12, y + 2), pct_text, fill="#24201D", font=font_val)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_history_trend_chart(
    sessions: List[dict],
    width: int = 680,
    height: int = 240,
) -> Optional[bytes]:
    """Render multi-session trend line chart across time for Alpha, Beta, Theta."""
    if len(sessions) < 2:
        return None

    img = Image.new("RGB", (width, height), color="#FAFAF8")
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle([(1, 1), (width - 2, height - 2)], radius=6, outline="#E8E2DD", width=1)

    font_title = _load_font(13, bold=True)
    font_legend = _load_font(10, bold=True)
    font_axis = _load_font(9, bold=False)

    # Title
    draw.text((24, 16), "Session Band Power Longitudinal Trends", fill="#24201D", font=font_title)

    # Legend
    legend_items = [
        ("Alpha (Relaxation)", BAND_COLORS["Alpha"]),
        ("Beta (Focus)", BAND_COLORS["Beta"]),
        ("Theta (Drowsiness)", BAND_COLORS["Theta"]),
    ]
    leg_x = width - 360
    for label, col in legend_items:
        draw.rectangle([(leg_x, 20), (leg_x + 10, 26)], fill=col)
        draw.text((leg_x + 14, 17), label, fill="#4A4540", font=font_legend)
        leg_x += 115

    draw.line([(24, 42), (width - 24, 42)], fill="#EFEAE6", width=1)

    # Plot area
    px0, py0 = 60, 56
    px1, py1 = width - 40, height - 42
    pw = px1 - px0
    ph = py1 - py0

    # Gridlines and y-axis ticks (0%, 25%, 50%, 75%, 100%)
    for tick in [0.0, 0.25, 0.50, 0.75, 1.0]:
        y_pos = py1 - int(tick * ph)
        draw.line([(px0, y_pos), (px1, y_pos)], fill="#EAE5E0", width=1)
        draw.text((px0 - 36, y_pos - 6), f"{int(tick*100)}%", fill="#8A8580", font=font_axis)

    n = len(sessions)
    step_x = pw / max(1, n - 1)

    series_data = {
        "alpha": [float(s.get("features", {}).get("relative_alpha", 0.0)) for s in sessions],
        "beta": [float(s.get("features", {}).get("relative_beta", 0.0)) for s in sessions],
        "theta": [float(s.get("features", {}).get("relative_theta", 0.0)) for s in sessions],
    }

    # Draw lines & points
    for key, color in [("alpha", BAND_COLORS["Alpha"]), ("beta", BAND_COLORS["Beta"]), ("theta", BAND_COLORS["Theta"])]:
        vals = series_data[key]
        points = []
        for i, val in enumerate(vals):
            clamped = max(0.0, min(1.0, val))
            cx = px0 + int(i * step_x)
            cy = py1 - int(clamped * ph)
            points.append((cx, cy))

        # Draw line segments
        for i in range(len(points) - 1):
            draw.line([points[i], points[i + 1]], fill=color, width=2)

        # Draw dots
        for cx, cy in points:
            draw.ellipse([(cx - 3, cy - 3), (cx + 3, cy + 3)], fill=color, outline="#FFFFFF", width=1)

    # X-axis session labels
    for i, s in enumerate(sessions):
        cx = px0 + int(i * step_x)
        started = s.get("started_at", "")[:10]
        label = f"S{i+1}\n{started[5:]}"
        draw.text((cx - 14, py1 + 8), label, fill="#6B6661", font=font_axis)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
