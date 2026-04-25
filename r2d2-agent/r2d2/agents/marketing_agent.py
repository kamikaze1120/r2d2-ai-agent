"""Marketing agent: generates Pinterest pin copy, TikTok scripts, SEO blogs.

Output is text-only — actual posting requires platform APIs / approvals
the user can wire later. Saved as files in WORKSPACE/marketing/.
"""
from __future__ import annotations
from . import _llm
from ..memory import business_memory
from .. import config


SYSTEM = ("You are a high-conversion social-media copywriter for digital "
          "products. You write short, punchy, hook-led copy.")


async def run(task: dict) -> dict:
    payload = task.get("payload", {})
    product_id = payload.get("product_id")
    product = next((p for p in business_memory.list_products()
                    if p["id"] == product_id), None)
    if not product:
        return {"ok": False, "error": f"product {product_id} not found"}

    prompt = (
        f"Product: {product['title']} ({product['product_type']})\n\n"
        "Generate marketing assets. Return JSON:\n"
        '{"pinterest_pins":[{"title":"","description":"","hashtags":[]}]*5,'
        '"tiktok_script":"30-second script with hook + 3 beats + CTA",'
        '"blog_post":{"title":"","outline":["H2 sections"],"meta_description":""}}'
    )
    data = await _llm.llm_json(prompt, system=SYSTEM) or {}

    out_dir = config.WORKSPACE / "marketing" / product_id
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "marketing.json").write_text(__import__("json").dumps(data, indent=2))
    return {"ok": True, "path": str(out_dir / "marketing.json"),
            "assets": list(data.keys())}
