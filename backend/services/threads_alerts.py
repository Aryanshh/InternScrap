"""
Alert Dispatcher for Threads Opportunity Radar.

Sends deduplicated notifications for newly discovered Graphic, Tech, and Project
opportunities across optional Discord/Slack/generic Webhooks, Telegram Bot API,
and the built-in InternScrap Email Digest renderer.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import httpx

from backend.config import settings
from backend.services.email_digest import (
    DIGEST_DIR,
    save_digest_record,
    send_email_digest,
)

logger = logging.getLogger(__name__)

ALERTED_IDS_FILE = DIGEST_DIR / "threads_alerted_ids.json"
ALERT_HISTORY_FILE = DIGEST_DIR / "threads_alert_history.json"


def _load_alerted_keys() -> Set[str]:
    if not ALERTED_IDS_FILE.exists():
        return set()
    try:
        data = json.loads(ALERTED_IDS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return {str(item) for item in data}
    except (OSError, ValueError) as exc:
        logger.debug(f"Could not read Threads alerted IDs log: {exc}")
    return set()


def _save_alerted_keys(keys: Set[str]) -> None:
    try:
        DIGEST_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    # Cap stored fingerprints to avoid unbounded file growth
    trimmed = list(keys)[-1000:]
    try:
        ALERTED_IDS_FILE.write_text(json.dumps(trimmed, indent=2), encoding="utf-8")
    except Exception:
        pass


def _append_alert_history(entry: Dict[str, Any]) -> None:
    try:
        DIGEST_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    history: List[Dict[str, Any]] = []
    if ALERT_HISTORY_FILE.exists():
        try:
            loaded = json.loads(ALERT_HISTORY_FILE.read_text(encoding="utf-8"))
            if isinstance(loaded, list):
                history = loaded
        except (OSError, ValueError):
            history = []
    history.insert(0, entry)
    try:
        ALERT_HISTORY_FILE.write_text(json.dumps(history[:50], indent=2), encoding="utf-8")
    except Exception:
        pass


def get_alert_history(limit: int = 10) -> List[Dict[str, Any]]:
    """Returns recent Threads alert dispatch logs."""
    if not ALERT_HISTORY_FILE.exists():
        return []
    try:
        loaded = json.loads(ALERT_HISTORY_FILE.read_text(encoding="utf-8"))
        return loaded[:limit] if isinstance(loaded, list) else []
    except (OSError, ValueError):
        return []


def _format_discord_embeds(opportunities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Formats new Threads opportunities as a Discord webhook payload."""
    embeds = []
    for opp in opportunities[:5]:
        urls = opp.get("apply_urls") or []
        primary_url = urls[0] if urls else ""
        budget = opp.get("salary_range") or "Not specified"
        embeds.append({
            "title": (opp.get("title") or "Threads Opportunity")[:240],
            "url": primary_url if primary_url.startswith("http") else None,
            "description": (opp.get("description") or "")[:350],
            "color": 1084582,  # Slate/Emerald accent
            "fields": [
                {"name": "Category", "value": opp.get("category") or "Threads", "inline": True},
                {"name": "Poster", "value": opp.get("company") or "@threads", "inline": True},
                {"name": "Budget / Rate", "value": budget, "inline": True},
            ],
        })
    return {
        "username": "InternScrap Threads Radar",
        "content": f"Discovered {len(opportunities)} new Threads opportunity lead(s).",
        "embeds": embeds,
    }


def _format_generic_webhook_payload(opportunities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Formats Slack/generic JSON webhook payload."""
    lines = [f"*InternScrap Threads Radar*: {len(opportunities)} new opportunity post(s) found."]
    for opp in opportunities[:5]:
        urls = opp.get("apply_urls") or []
        link = urls[0] if urls else ""
        budget = f" ({opp['salary_range']})" if opp.get("salary_range") else ""
        lines.append(f"- [{opp.get('category')}] {opp.get('title')}{budget} — {link}")
    return {
        "text": "\n".join(lines),
        "count": len(opportunities),
        "opportunities": [
            {
                "id": opp.get("id"),
                "title": opp.get("title"),
                "company": opp.get("company"),
                "category": opp.get("category"),
                "salary_range": opp.get("salary_range"),
                "apply_urls": opp.get("apply_urls", []),
            }
            for opp in opportunities[:10]
        ],
    }


def _format_telegram_message(opportunities: List[Dict[str, Any]]) -> str:
    """Formats plain/Markdown summary for Telegram Bot API."""
    lines = [f"InternScrap Threads Radar: {len(opportunities)} new opportunity(ies)"]
    for opp in opportunities[:5]:
        urls = opp.get("apply_urls") or []
        link = urls[0] if urls else ""
        budget = f" | {opp['salary_range']}" if opp.get("salary_range") else ""
        lines.append(
            f"\n[{opp.get('category', 'Threads')}] {opp.get('title', '')}{budget}\n"
            f"Poster: {opp.get('company', '@threads')}\n{link}"
        )
    return "\n".join(lines)[:3900]


def _render_threads_email_html(opportunities: List[Dict[str, Any]]) -> str:
    """Renders clean HTML email alert summarizing newly discovered Threads opportunities."""
    cards = []
    for opp in opportunities[:10]:
        urls = opp.get("apply_urls") or ["#"]
        first_url = urls[0] if urls else "#"
        budget = opp.get("salary_range") or "Unspecified"
        snippet = (opp.get("description") or "")[:240].replace("<", "&lt;").replace(">", "&gt;")
        cards.append(
            f"<div style='border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px;background:#ffffff;'>"
            f"<div style='font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;'>{opp.get('category', 'Threads')}</div>"
            f"<h3 style='margin:4px 0;font-size:16px;color:#0f172a;'>{opp.get('title', 'Opportunity')}</h3>"
            f"<div style='font-size:12px;color:#475569;margin-bottom:8px;'>{opp.get('company', '@threads')} &bull; Budget: {budget}</div>"
            f"<p style='font-size:13px;color:#334155;margin:0 0 10px 0;'>{snippet}</p>"
            f"<a href='{first_url}' style='display:inline-block;background:#0f172a;color:#ffffff;padding:7px 14px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;'>Open Opportunity</a>"
            f"</div>"
        )
    return (
        "<!DOCTYPE html><html><body style='font-family:sans-serif;background:#f8fafc;padding:24px;'>"
        "<div style='max-width:600px;margin:0 auto;'>"
        f"<h2 style='color:#0f172a;'>Threads Opportunity Radar ({len(opportunities)} New)</h2>"
        + "".join(cards)
        + "</div></body></html>"
    )


async def dispatch_threads_alerts(
    opportunities: List[Dict[str, Any]],
    *,
    webhook_url: Optional[str] = None,
    telegram_bot_token: Optional[str] = None,
    telegram_chat_id: Optional[str] = None,
    send_email_preview: bool = True,
    deduplicate: bool = True,
) -> Dict[str, Any]:
    """
    Dispatches alerts for newly discovered Threads opportunities to configured channels.
    """
    if not opportunities:
        return {"sent_count": 0, "channels": {}, "skipped": "no_opportunities"}

    alerted_keys = _load_alerted_keys()
    to_notify: List[Dict[str, Any]] = []

    for opp in opportunities:
        key = str(opp.get("fingerprint") or opp.get("id") or "")
        if deduplicate and key and key in alerted_keys:
            continue
        to_notify.append(opp)
        if key:
            alerted_keys.add(key)

    if not to_notify:
        return {"sent_count": 0, "channels": {}, "skipped": "already_alerted"}

    target_webhook = (webhook_url if webhook_url is not None else settings.THREADS_WEBHOOK_URL).strip()
    target_tg_token = (telegram_bot_token if telegram_bot_token is not None else settings.THREADS_TELEGRAM_BOT_TOKEN).strip()
    target_tg_chat = (telegram_chat_id if telegram_chat_id is not None else settings.THREADS_TELEGRAM_CHAT_ID).strip()

    channels: Dict[str, Any] = {}

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Webhook (Discord / Slack / Generic REST)
        if target_webhook:
            is_discord = "discord.com/api/webhooks" in target_webhook.lower() or "discordapp.com/api/webhooks" in target_webhook.lower()
            payload = _format_discord_embeds(to_notify) if is_discord else _format_generic_webhook_payload(to_notify)
            try:
                resp = await client.post(target_webhook, json=payload)
                channels["webhook"] = {
                    "success": 200 <= resp.status_code < 300,
                    "status_code": resp.status_code,
                    "type": "discord" if is_discord else "generic",
                }
            except httpx.HTTPError as exc:
                channels["webhook"] = {"success": False, "error": str(exc)}
        else:
            channels["webhook"] = {"success": False, "skipped": "not_configured"}

        # 2. Telegram Bot API
        if target_tg_token and target_tg_chat:
            tg_url = f"https://api.telegram.org/bot{target_tg_token}/sendMessage"
            try:
                resp = await client.post(
                    tg_url,
                    json={
                        "chat_id": target_tg_chat,
                        "text": _format_telegram_message(to_notify),
                        "disable_web_page_preview": False,
                    },
                )
                channels["telegram"] = {
                    "success": 200 <= resp.status_code < 300,
                    "status_code": resp.status_code,
                }
            except httpx.HTTPError as exc:
                channels["telegram"] = {"success": False, "error": str(exc)}
        else:
            channels["telegram"] = {"success": False, "skipped": "not_configured"}

    # 3. Email Digest Preview / SMTP fallback
    if send_email_preview:
        html_content = _render_threads_email_html(to_notify)
        save_digest_record(html_content, len(to_notify), recipient="candidate@example.com")
        channels["email_digest"] = send_email_digest(
            subject=f"InternScrap Threads Radar: {len(to_notify)} New Graphic/Tech/Project Leads",
            html_content=html_content,
            recipient="candidate@example.com",
        )

    if deduplicate:
        _save_alerted_keys(alerted_keys)

    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "opportunities_count": len(to_notify),
        "titles": [opp.get("title", "") for opp in to_notify[:5]],
        "channels": channels,
    }
    _append_alert_history(log_entry)

    return {
        "sent_count": len(to_notify),
        "channels": channels,
        "log": log_entry,
    }
