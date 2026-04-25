"""Product agent: generates real digital files for a chosen niche."""
from __future__ import annotations
from . import _llm
from ..memory import business_memory
from ..tools_pkg import file_generator


SYSTEM = (
    "You are a digital product designer. You write concise, useful, "
    "professionally structured content for sellable printables, ebooks, "
    "planners, and wall art. Output is always crisp and copy-ready."
)


async def _planner(niche: dict) -> dict:
    prompt = (
        f"Design a printable PDF planner for the niche: {niche['name']}.\n"
        f"Keywords: {', '.join(niche.get('keywords', []))}\n\n"
        'Return JSON: {"title":"","subtitle":"","sections":[{"heading":"",'
        '"items":["10-15 short actionable lines"]}]}'
        " — exactly 4 sections."
    )
    data = await _llm.llm_json(prompt, system=SYSTEM)
    if not data:
        return {"ok": False, "error": "planner LLM failed"}
    return file_generator.generate_planner_pdf(
        title=data.get("title", niche["name"] + " Planner"),
        subtitle=data.get("subtitle", ""),
        sections=data.get("sections", []),
    )


async def _ebook(niche: dict) -> dict:
    prompt = (
        f"Outline a short sellable ebook for the niche: {niche['name']}.\n"
        f"Keywords: {', '.join(niche.get('keywords', []))}\n\n"
        '5 chapters. Return JSON: {"title":"","author":"R2D2 Studio",'
        '"chapters":[{"title":"","paragraphs":["3-5 paragraphs of real prose"]}]}'
    )
    data = await _llm.llm_json(prompt, system=SYSTEM)
    if not data:
        return {"ok": False, "error": "ebook LLM failed"}
    return file_generator.generate_ebook_pdf(
        title=data.get("title", niche["name"]),
        author=data.get("author", "R2D2 Studio"),
        chapters=data.get("chapters", []),
    )


async def _wall_art(niche: dict) -> dict:
    prompt = (
        f"Write ONE short, evocative quote (≤14 words) suitable for a "
        f"typographic wall-art print in the niche: {niche['name']}.\n"
        'Return JSON: {"title":"","quote":"","bg":"#hex","fg":"#hex"}'
    )
    data = await _llm.llm_json(prompt, system=SYSTEM) or {}
    return file_generator.generate_wall_art_png(
        title=data.get("title", niche["name"] + " Print"),
        quote=data.get("quote", niche["name"]),
        bg=data.get("bg", "#F8F4EC"),
        fg=data.get("fg", "#1B1B1B"),
    )


async def _sticker_pack(niche: dict) -> dict:
    prompt = (
        f"Design a 12-piece sticker pack for: {niche['name']}.\n"
        'Return JSON: {"title":"","stickers":[{"label":"short word",'
        '"color":"#hex"}]}'
    )
    data = await _llm.llm_json(prompt, system=SYSTEM) or {}
    return file_generator.generate_sticker_pack(
        title=data.get("title", niche["name"] + " Stickers"),
        sticker_specs=data.get("stickers", [{"label": niche["name"]}]),
    )


_GENERATORS = {
    "planner_pdf": _planner,
    "ebook_pdf": _ebook,
    "wall_art_png": _wall_art,
    "sticker_pack": _sticker_pack,
}


async def run(task: dict) -> dict:
    payload = task.get("payload", {})
    niche_id = payload.get("niche_id")
    product_type = payload.get("product_type", "planner_pdf")
    niche = next((n for n in business_memory.list_niches()
                  if n["id"] == niche_id), None)
    if not niche:
        return {"ok": False, "error": f"niche {niche_id} not found"}

    fn = _GENERATORS.get(product_type)
    if not fn:
        return {"ok": False, "error": f"unknown product_type {product_type}"}

    gen = await fn(niche)
    if not gen.get("ok"):
        return gen

    product = business_memory.add_product(
        niche_id=niche_id,
        title=niche["name"],
        product_type=product_type,
        file_path=gen.get("path"),
        metadata={"size_bytes": gen.get("size_bytes"),
                  "generator": gen.get("type")},
    )
    return {"ok": True, "product": product, "file": gen}
