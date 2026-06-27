"""Email tool — SMTP send + IMAP read.

Supports Gmail, Outlook, Yahoo, or any standard SMTP/IMAP server.
For Gmail: use an App Password (Google Account → Security → App Passwords).
Credentials come from config.py (EMAIL_ADDRESS, EMAIL_PASSWORD, etc.).
"""
from __future__ import annotations
import email as _email_lib
import imaplib
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, parseaddr
from typing import Any
from .. import config


def configured() -> bool:
    return bool(config.EMAIL_ADDRESS and config.EMAIL_PASSWORD)


# ── Send ──────────────────────────────────────────────────────────────────────

def send_email(
    to: str | list[str],
    subject: str,
    body: str,
    html: bool = False,
    cc: str | list[str] | None = None,
    reply_to: str | None = None,
) -> dict:
    """Send an email via SMTP."""
    if not configured():
        return {"ok": False, "error": "EMAIL_ADDRESS or EMAIL_PASSWORD not set in .env"}

    recipients = [to] if isinstance(to, str) else to
    cc_list = ([cc] if isinstance(cc, str) else cc) if cc else []

    msg = MIMEMultipart("alternative")
    msg["From"]    = formataddr(("R2D2", config.EMAIL_ADDRESS))
    msg["To"]      = ", ".join(recipients)
    msg["Subject"] = subject
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)
    if reply_to:
        msg["Reply-To"] = reply_to

    mime_type = "html" if html else "plain"
    msg.attach(MIMEText(body, mime_type, "utf-8"))

    all_recipients = recipients + cc_list

    try:
        with smtplib.SMTP(config.EMAIL_SMTP_HOST, config.EMAIL_SMTP_PORT, timeout=30) as s:
            s.ehlo()
            s.starttls()
            s.login(config.EMAIL_ADDRESS, config.EMAIL_PASSWORD)
            s.sendmail(config.EMAIL_ADDRESS, all_recipients, msg.as_string())
        return {
            "ok": True,
            "to": recipients,
            "subject": subject,
            "timestamp": time.time(),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Read ──────────────────────────────────────────────────────────────────────

def _connect_imap() -> imaplib.IMAP4_SSL:
    conn = imaplib.IMAP4_SSL(config.EMAIL_IMAP_HOST, timeout=30)
    conn.login(config.EMAIL_ADDRESS, config.EMAIL_PASSWORD)
    return conn


def _parse_message(raw_bytes: bytes) -> dict[str, Any]:
    msg = _email_lib.message_from_bytes(raw_bytes)
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                break
    else:
        body = msg.get_payload(decode=True).decode("utf-8", errors="replace")

    return {
        "from": msg.get("From", ""),
        "to": msg.get("To", ""),
        "subject": msg.get("Subject", ""),
        "date": msg.get("Date", ""),
        "body": body[:3000],
        "message_id": msg.get("Message-ID", ""),
    }


def read_emails(folder: str = "INBOX", count: int = 10, unread_only: bool = False) -> dict:
    """Read the most recent emails from a folder."""
    if not configured():
        return {"ok": False, "error": "EMAIL credentials not set"}
    try:
        conn = _connect_imap()
        conn.select(folder)
        criterion = "UNSEEN" if unread_only else "ALL"
        _, data = conn.search(None, criterion)
        ids = data[0].split()
        ids = ids[-count:] if len(ids) > count else ids
        messages = []
        for uid in reversed(ids):
            _, msg_data = conn.fetch(uid, "(RFC822)")
            if msg_data and msg_data[0]:
                messages.append(_parse_message(msg_data[0][1]))
        conn.logout()
        return {"ok": True, "folder": folder, "messages": messages, "count": len(messages)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def search_emails(query: str, folder: str = "INBOX", count: int = 10) -> dict:
    """Search emails by subject or sender."""
    if not configured():
        return {"ok": False, "error": "EMAIL credentials not set"}
    try:
        conn = _connect_imap()
        conn.select(folder)
        # Search by subject OR from
        _, sub_data = conn.search(None, f'SUBJECT "{query}"')
        _, from_data = conn.search(None, f'FROM "{query}"')
        ids = list(set(
            (sub_data[0].split() if sub_data[0] else []) +
            (from_data[0].split() if from_data[0] else [])
        ))
        ids = ids[-count:]
        messages = []
        for uid in reversed(ids):
            _, msg_data = conn.fetch(uid, "(RFC822)")
            if msg_data and msg_data[0]:
                messages.append(_parse_message(msg_data[0][1]))
        conn.logout()
        return {"ok": True, "query": query, "messages": messages, "count": len(messages)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def list_folders() -> dict:
    """List all IMAP folders/labels."""
    if not configured():
        return {"ok": False, "error": "EMAIL credentials not set"}
    try:
        conn = _connect_imap()
        _, folders = conn.list()
        names = []
        for f in folders:
            parts = f.decode().split('"/"')
            if parts:
                names.append(parts[-1].strip().strip('"'))
        conn.logout()
        return {"ok": True, "folders": names}
    except Exception as e:
        return {"ok": False, "error": str(e)}
