import os
import smtplib
import json
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Dict, Any, Optional
from pathlib import Path

DIGEST_DIR = Path(__file__).resolve().parent.parent / "generated_digests"
DIGEST_DIR.mkdir(parents=True, exist_ok=True)

LATEST_DIGEST_FILE = DIGEST_DIR / "latest_digest.html"
DIGEST_HISTORY_FILE = DIGEST_DIR / "digest_history.json"

def render_digest_html(
    candidate_name: str,
    candidate_headline: str,
    high_match_jobs: List[Dict[str, Any]],
    app_url: str = "http://127.0.0.1:5173"
) -> str:
    """Renders a responsive, modern HTML email digest for high-match job opportunities."""
    now_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    
    job_cards_html = ""
    for j in high_match_jobs:
        match = j.get("match", {})
        score = match.get("blended_score", 0) if match else 0
        apply_url = j.get("apply_urls", ["#"])[0] if j.get("apply_urls") else "#"
        tailor_link = f"{app_url}?tailor={j.get('id')}"
        
        salary_html = ""
        if j.get("salary_range"):
            salary_html = f"""<span style="display:inline-block; background-color:#ECFDF5; color:#059669; font-size:11px; font-weight:600; padding:2px 8px; border-radius:6px; margin-right:6px;">{j['salary_range']}</span>"""

        remote_badge = f"""<span style="display:inline-block; background-color:#F1F5F9; color:#475569; font-size:11px; font-weight:600; padding:2px 8px; border-radius:6px; margin-right:6px; text-transform:capitalize;">{j.get('remote_type', 'remote')}</span>"""
        
        internship_badge = ""
        if j.get("is_internship"):
            internship_badge = """<span style="display:inline-block; background-color:#FEF3C7; color:#D97706; font-size:11px; font-weight:600; padding:2px 8px; border-radius:6px; margin-right:6px;">Internship</span>"""

        desc_snippet = (j.get("description", "")[:180] + "...").replace("<", "&lt;").replace(">", "&gt;")

        job_cards_html += f"""
        <div style="background-color:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:20px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div style="flex:1;">
                    <h3 style="margin:0 0 4px 0; font-size:17px; font-weight:700; color:#0F172A;">{j.get('title')}</h3>
                    <p style="margin:0; font-size:13px; font-weight:600; color:#2563EB;">{j.get('company')} &bull; <span style="font-weight:400; color:#64748B;">{j.get('location') or 'Remote'}</span></p>
                </div>
                <div style="background-color:#ECFDF5; border:1px solid #A7F3D0; color:#047857; font-size:13px; font-weight:700; padding:4px 10px; border-radius:20px; white-space:nowrap; margin-left:12px;">
                    {score}% Match
                </div>
            </div>
            
            <div style="margin:10px 0;">
                {remote_badge}
                {internship_badge}
                {salary_html}
            </div>

            <p style="margin:8px 0 16px 0; font-size:13px; line-height:1.5; color:#475569;">
                {desc_snippet}
            </p>

            <div style="display:flex; gap:10px; align-items:center;">
                <a href="{apply_url}" target="_blank" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; font-size:12px; font-weight:600; padding:8px 16px; border-radius:8px; text-decoration:none;">
                    Apply Directly &rarr;
                </a>
                <a href="{tailor_link}" target="_blank" style="display:inline-block; background-color:#F0FDFA; color:#0D9488; border:1px solid #99F6E4; font-size:12px; font-weight:600; padding:7px 14px; border-radius:8px; text-decoration:none;">
                    Tailor Resume
                </a>
            </div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>InternScrap High-Match Opportunity Digest</title>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFC; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155;">
    <div style="max-width:620px; margin:0 auto; padding:24px 16px;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg, #1E1B4B 0%, #312E81 100%); border-radius:16px; padding:28px 24px; color:#FFFFFF; margin-bottom:24px; text-align:center;">
            <div style="display:inline-block; background-color:rgba(255,255,255,0.12); padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:12px; color:#A5B4FC;">
                InternScrap Automated Digest
            </div>
            <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:800; tracking-tight;">High-Match Opportunity Alert</h1>
            <p style="margin:0; font-size:13px; color:#C7D2FE;">{now_str} &bull; Tailored for {candidate_name}</p>
        </div>

        <!-- Greeting -->
        <div style="background-color:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:18px 20px; margin-bottom:20px;">
            <p style="margin:0 0 6px 0; font-size:14px; font-weight:600; color:#0F172A;">
                Hello {candidate_name},
            </p>
            <p style="margin:0; font-size:13px; line-height:1.5; color:#475569;">
                Our background aggregator just ran scheduled discovery across Remotive, Arbeitnow, RemoteOK, and The Muse. We surfaced <strong>{len(high_match_jobs)} opportunities</strong> that strongly match your profile ({candidate_headline}) with an honest score &ge; 70%.
            </p>
        </div>

        <!-- Job Cards -->
        <div>
            {job_cards_html if job_cards_html else '<p style="text-align:center; color:#94A3B8;">No new high-match listings found in this cycle.</p>'}
        </div>

        <!-- Footer -->
        <div style="text-align:center; padding:20px; font-size:11px; color:#94A3B8; border-top:1px solid #E2E8F0; margin-top:24px;">
            <p style="margin:0 0 4px 0;">InternScrap &bull; ToS-Safe Multi-Source Aggregator &amp; ATS Resume Tailor</p>
            <p style="margin:0;">To adjust your digest threshold or frequency, update your background scheduler settings.</p>
        </div>
    </div>
</body>
</html>
"""
    return html

def save_digest_record(html: str, jobs_count: int, recipient: str = "user@example.com") -> Dict[str, Any]:
    """Saves the rendered digest for preview and records to history."""
    with open(LATEST_DIGEST_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "jobs_count": jobs_count,
        "recipient": recipient,
        "status": "delivered_mock"
    }

    history = []
    if DIGEST_HISTORY_FILE.exists():
        try:
            with open(DIGEST_HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            history = []

    history.insert(0, record)
    with open(DIGEST_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history[:50], f, indent=2)

    return record

def send_email_digest(
    subject: str,
    html_content: str,
    recipient: str,
    smtp_host: Optional[str] = None,
    smtp_port: int = 587,
    smtp_user: Optional[str] = None,
    smtp_pass: Optional[str] = None
) -> Dict[str, Any]:
    """
    Dispatches email via SMTP if credentials are provided,
    otherwise saves to mock log for safe testing.
    """
    # If SMTP is configured
    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = recipient

            part = MIMEText(html_content, "html")
            msg.attach(part)

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, recipient, msg.as_string())

            return {"success": True, "method": "smtp", "recipient": recipient}
        except Exception as e:
            return {"success": False, "error": str(e), "method": "smtp_failed"}
    else:
        # Fallback local delivery
        return {"success": True, "method": "local_preview", "recipient": recipient}

def get_latest_digest_html() -> str:
    """Reads latest generated digest HTML from disk."""
    if LATEST_DIGEST_FILE.exists():
        with open(LATEST_DIGEST_FILE, "r", encoding="utf-8") as f:
            return f.read()
    return "<p style='padding:20px; font-family:sans-serif;'>No email digest has been generated yet. Run the scheduler or click 'Send Test Digest' to generate one!</p>"
