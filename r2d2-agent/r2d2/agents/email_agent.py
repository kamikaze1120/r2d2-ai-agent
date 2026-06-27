"""Email agent — read, search, and send emails via SMTP/IMAP.

TASK_TYPES accepted by the dispatcher:
  email_send    — send an email (payload: to, subject, body, html?)
  email_read    — read recent emails (payload: folder, count, unread_only?)
  email_search  — search emails (payload: query, folder?, count?)
  email_task    — generic email task described in payload["instruction"]
"""
from __future__ import annotations
from ..tools_pkg import email_tool
from ._llm import llm_text

TASK_TYPES = ["email_send", "email_read", "email_search", "email_task"]

_SYSTEM = (
    "You are R2D2's email sub-agent. "
    "Given email data and an instruction, extract or summarise the relevant information. "
    "Be concise, structured, and accurate."
)


async def run(task: dict) -> dict:
    payload  = task.get("payload", {})
    task_type = task.get("type", "email_task")

    # ── Send ─────────────────────────────────────────────────────────────────
    if task_type == "email_send":
        to      = payload.get("to")
        subject = payload.get("subject", "(no subject)")
        body    = payload.get("body", "")
        if not to:
            return {"ok": False, "error": "payload.to is required"}
        result = email_tool.send_email(
            to=to,
            subject=subject,
            body=body,
            html=payload.get("html", False),
            cc=payload.get("cc"),
        )
        return result

    # ── Read ──────────────────────────────────────────────────────────────────
    if task_type == "email_read":
        result = email_tool.read_emails(
            folder=payload.get("folder", "INBOX"),
            count=int(payload.get("count", 10)),
            unread_only=bool(payload.get("unread_only", False)),
        )
        if not result.get("ok"):
            return result
        # Summarise if instruction provided
        instruction = payload.get("instruction")
        if instruction and result.get("messages"):
            digest = "\n\n".join(
                f"From: {m['from']}\nSubject: {m['subject']}\nDate: {m['date']}\n{m['body'][:500]}"
                for m in result["messages"]
            )
            summary = await llm_text(
                f"Instruction: {instruction}\n\nEmails:\n{digest}",
                system=_SYSTEM,
            )
            result["summary"] = summary
        return result

    # ── Search ────────────────────────────────────────────────────────────────
    if task_type == "email_search":
        query = payload.get("query", "")
        if not query:
            return {"ok": False, "error": "payload.query is required"}
        result = email_tool.search_emails(
            query=query,
            folder=payload.get("folder", "INBOX"),
            count=int(payload.get("count", 10)),
        )
        return result

    # ── Generic email task ────────────────────────────────────────────────────
    instruction = payload.get("instruction", "")
    if not instruction:
        return {"ok": False, "error": "payload.instruction required for email_task"}

    instr_lower = instruction.lower()

    # Route to send/read/search based on instruction keywords
    if any(kw in instr_lower for kw in ["send", "write", "compose", "reply", "forward"]):
        # Use LLM to draft the email fields from the instruction
        draft_prompt = (
            f"Instruction: {instruction}\n\n"
            "Extract the following fields as JSON:\n"
            '{"to": "...", "subject": "...", "body": "..."}\n'
            "If a field is not clear from the instruction, use a sensible default."
        )
        from ._llm import llm_json
        draft = await llm_json(draft_prompt)
        if not draft or not isinstance(draft, dict):
            return {"ok": False, "error": "Could not parse email draft from instruction"}
        return email_tool.send_email(
            to=draft.get("to", ""),
            subject=draft.get("subject", "(no subject)"),
            body=draft.get("body", ""),
        )

    if any(kw in instr_lower for kw in ["search", "find", "look for"]):
        # Extract search query from instruction
        query = instruction.replace("search", "").replace("find", "").replace("look for", "").strip()
        result = email_tool.search_emails(query=query)
        if not result.get("ok"):
            return result
    else:
        # Default: read recent emails
        result = email_tool.read_emails()
        if not result.get("ok"):
            return result

    # Summarise what was found
    if result.get("messages"):
        digest = "\n\n".join(
            f"From: {m['from']}\nSubject: {m['subject']}\nDate: {m['date']}\n{m['body'][:500]}"
            for m in result["messages"]
        )
        summary = await llm_text(
            f"Instruction: {instruction}\n\nEmails:\n{digest}",
            system=_SYSTEM,
        )
        result["summary"] = summary

    return result
