"""File generators: PDF planners, ebooks, PNG wall art, sticker packs.

Heavy deps (reportlab, Pillow) are imported lazily so the server still boots
if a user hasn't run `pip install -r requirements.txt`.
"""
from __future__ import annotations
import uuid
from pathlib import Path
from .. import config


def _slug(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")[:60]


def _new_path(title: str, ext: str) -> Path:
    name = f"{_slug(title)}-{uuid.uuid4().hex[:6]}.{ext}"
    return config.PRODUCTS_DIR / name


# ---------------- PDF planner / checklist / worksheet ----------------

def generate_planner_pdf(title: str, sections: list[dict],
                         subtitle: str = "") -> dict:
    """sections = [{"heading": "...", "items": ["..."]}]"""
    try:
        from reportlab.lib.pagesizes import LETTER
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                        PageBreak, ListFlowable, ListItem)
    except ImportError:
        return {"ok": False, "error": "reportlab not installed"}

    out = _new_path(title, "pdf")
    doc = SimpleDocTemplate(str(out), pagesize=LETTER,
                            title=title, author="R2D2")
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Title"])]
    if subtitle:
        story.append(Paragraph(subtitle, styles["Italic"]))
    story.append(Spacer(1, 18))

    for s in sections:
        story.append(Paragraph(s.get("heading", ""), styles["Heading2"]))
        items = [ListItem(Paragraph(i, styles["Normal"]))
                 for i in s.get("items", [])]
        if items:
            story.append(ListFlowable(items, bulletType="bullet"))
        story.append(Spacer(1, 14))
        if s.get("page_break"):
            story.append(PageBreak())

    doc.build(story)
    return {"ok": True, "path": str(out), "type": "pdf",
            "size_bytes": out.stat().st_size}


# ---------------- Ebook (multi-chapter PDF) ----------------

def generate_ebook_pdf(title: str, author: str,
                       chapters: list[dict]) -> dict:
    """chapters = [{"title": "...", "paragraphs": ["..."]}]"""
    try:
        from reportlab.lib.pagesizes import LETTER
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                        PageBreak)
    except ImportError:
        return {"ok": False, "error": "reportlab not installed"}

    out = _new_path(title, "pdf")
    doc = SimpleDocTemplate(str(out), pagesize=LETTER, title=title, author=author)
    styles = getSampleStyleSheet()
    story = [
        Spacer(1, 200),
        Paragraph(title, styles["Title"]),
        Spacer(1, 24),
        Paragraph(f"by {author}", styles["Italic"]),
        PageBreak(),
    ]
    for i, ch in enumerate(chapters, 1):
        story.append(Paragraph(f"Chapter {i}: {ch.get('title','')}",
                               styles["Heading1"]))
        story.append(Spacer(1, 12))
        for para in ch.get("paragraphs", []):
            story.append(Paragraph(para, styles["BodyText"]))
            story.append(Spacer(1, 8))
        story.append(PageBreak())
    doc.build(story)
    return {"ok": True, "path": str(out), "type": "pdf",
            "size_bytes": out.stat().st_size,
            "pages": len(chapters) + 1}


# ---------------- PNG wall art ----------------

def generate_wall_art_png(title: str, quote: str, *,
                          width: int = 2400, height: int = 3000,
                          bg: str = "#F8F4EC", fg: str = "#1B1B1B") -> dict:
    """Typography poster — 4:5 ratio, print-ready 300 DPI on 8x10."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return {"ok": False, "error": "Pillow not installed"}

    img = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(img)

    # Try to load a nice font; fall back to default.
    def _font(size: int):
        for name in ("DejaVuSerif-Bold.ttf", "DejaVuSans-Bold.ttf",
                     "Arial.ttf", "/Library/Fonts/Georgia.ttf"):
            try:
                return ImageFont.truetype(name, size)
            except Exception:
                continue
        return ImageFont.load_default()

    body_font = _font(140)
    margin = 200
    text_w = width - margin * 2

    # naive word wrap
    words = quote.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        test = (cur + " " + w).strip()
        bbox = draw.textbbox((0, 0), test, font=body_font)
        if bbox[2] - bbox[0] > text_w and cur:
            lines.append(cur)
            cur = w
        else:
            cur = test
    if cur:
        lines.append(cur)

    line_h = body_font.size + 20
    total_h = line_h * len(lines)
    y = (height - total_h) // 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=body_font)
        x = (width - (bbox[2] - bbox[0])) // 2
        draw.text((x, y), line, fill=fg, font=body_font)
        y += line_h

    out = _new_path(title, "png")
    img.save(out, "PNG", dpi=(300, 300))
    return {"ok": True, "path": str(out), "type": "png",
            "size_bytes": out.stat().st_size,
            "dimensions": [width, height]}


# ---------------- Sticker pack (zip of PNGs) ----------------

def generate_sticker_pack(title: str, sticker_specs: list[dict]) -> dict:
    """sticker_specs = [{"label": "...", "emoji": "...", "color": "#..."}]
    Generates a folder of 1024x1024 PNG circles with text — placeholder art
    that prints fine but signals you'll plug in a real image model later.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return {"ok": False, "error": "Pillow not installed"}
    import zipfile

    folder = _new_path(title, "stickers")
    folder.mkdir(parents=True, exist_ok=True)

    def _font(size: int):
        for name in ("DejaVuSans-Bold.ttf", "Arial.ttf"):
            try:
                return ImageFont.truetype(name, size)
            except Exception:
                continue
        return ImageFont.load_default()

    for i, spec in enumerate(sticker_specs):
        img = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        color = spec.get("color", "#FFD66B")
        draw.ellipse((40, 40, 984, 984), fill=color, outline="#1B1B1B", width=14)
        label = spec.get("label", f"Sticker {i+1}")
        f = _font(140)
        bbox = draw.textbbox((0, 0), label, font=f)
        draw.text(((1024 - (bbox[2] - bbox[0])) // 2,
                   (1024 - (bbox[3] - bbox[1])) // 2),
                  label, fill="#1B1B1B", font=f)
        img.save(folder / f"sticker_{i+1:02d}.png", "PNG")

    zip_path = folder.with_suffix(".zip")
    with zipfile.ZipFile(zip_path, "w") as z:
        for p in folder.iterdir():
            z.write(p, arcname=p.name)
    return {"ok": True, "path": str(zip_path), "type": "zip",
            "count": len(sticker_specs),
            "size_bytes": zip_path.stat().st_size}
