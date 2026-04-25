"""Marketing agent: generates Pinterest pins, TikTok scripts, SEO blogs.

For Pinterest: if a Pinterest API token is configured, the agent posts pins
directly. Otherwise pins are written to a JSON queue. TikTok scripts always
go to a manual-post queue (no public posting API for TikTok personal accounts).
"""
from __future__ import annotations
import json
import time
import uuid
from . import _llm
from ..memory import business_memory
from ..tools_pkg import pinterest_tool
from ..core import audit_log
from .. import config


SYSTEM = ("You are a high-conversion social-media copywriter for digital "
          "products. You write short, punchy, hook-led copy.")


def _queue_path(kind: str) -> "object":
    p = config.WORKSPACE / "marketing_queue" / f"{kind}.jsonl"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _enqueue(kind: str, item: dict) -> None:
    item = {**item, "id": uuid.uuid4().hex[:10], "ts": time.time(),
            "status": "queued"}
    p = _queue_path(kind)
    with p.open("a") as f:
        f.write(json.dumps(item) + "\n")


def list_queue(kind: str) -> list[dict]:
    p = _queue_path(kind)
    if not p.exists():
        return []
    items = []
    for line in p.read_text().splitlines():
        try:
            items.append(json.loads(line))
        except Exception:
            continue
    return items


def mark_posted(kind: str, item_id: str) -> bool:
    p = _queue_path(kind)
    if not p.exists():
        return False
    items = list_queue(kind)
    found = False
    for it in items:
        if it.get("id") == item_id:
            it["status"] = "posted"
            it["posted_at"] = time.time()
            found = True
    if found:
        p.write_text("\n".join(json.dumps(i) for i in items) + "\n")
    return found


async def run(task: dict) -> dict:
    payload = task.get("payload", {})
    product_id = payload.get("product_id")
    product = next((p for p in business_memory.list_products()
                    if p["id"] == product_id), None)
    if not product:
        return {"ok": False, "error": f"product {product_id} not found"}

    listing = product.get("listing") or product.get("metadata", {}).get("listing") or {}
    title = listing.get("title") or product["title"]

    prompt = (
        f"Product: {title} ({product['product_type']})\n"
        f"Description excerpt: {(listing.get('description') or '')[:400]}\n\n"
        "Generate marketing assets. Return JSON:\n"
        '{"pinterest_pins":[{"title":"≤100 chars","description":"≤400 chars","hashtags":["#tag"]}]*5,'
        '"tiktok_scripts":[{"hook":"first 2s","beats":["beat1","beat2","beat3"],"cta":"CTA"}]*2,'
        '"blog_post":{"title":"","outline":["H2 sections"],"meta_description":"≤155 chars"}}'
    )
    data = await _llm.llm_json(prompt, system=SYSTEM) or {}

    out_dir = config.WORKSPACE / "marketing" / product_id
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "marketing.json").write_text(json.dumps(data, indent=2))

    posted = 0
    queued_pins = 0
    image_url = payload.get("image_url")  # optional public URL
    for pin in (data.get("pinterest_pins") or [])[:5]:
        if pinterest_tool.configured() and image_url:
            res = await pinterest_tool.create_pin(
                title=pin.get("title", title),
                description=pin.get("description", ""),
                link=payload.get("listing_url", ""),
                image_url=image_url,
            )
            if res.get("ok") and not res.get("dry_run"):
                posted += 1
                continue
        _enqueue("pinterest", {"product_id": product_id, **pin})
        queued_pins += 1

    queued_tiktoks = 0
    for script in (data.get("tiktok_scripts") or [])[:3]:
        _enqueue("tiktok", {"product_id": product_id, **script})
        queued_tiktoks += 1

    audit_log.log("marketing_agent", "marketing.generate",
                  target=product_id, outcome="ok",
                  detail={"pins_posted": posted, "pins_queued": queued_pins,
                          "tiktok_queued": queued_tiktoks})

    return {"ok": True, "path": str(out_dir / "marketing.json"),
            "pinterest_posted": posted,
            "pinterest_queued": queued_pins,
            "tiktok_queued": queued_tiktoks,
            "blog_post": data.get("blog_post")}
