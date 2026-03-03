"""
CHH Compliance – SendGrid Email Sender
======================================
Supports both SendGrid and Mailgun (set EMAIL_PROVIDER in .env).
Sends per-department digests + critical alerts.
"""

import os, json, logging
from datetime import datetime, timedelta
from typing import List

logger = logging.getLogger(__name__)

EMAIL_PROVIDER  = os.getenv("EMAIL_PROVIDER", "sendgrid")   # sendgrid | mailgun
SENDGRID_KEY    = os.getenv("SENDGRID_API_KEY", "")
MAILGUN_KEY     = os.getenv("MAILGUN_API_KEY", "")
MAILGUN_DOMAIN  = os.getenv("MAILGUN_DOMAIN", "")
FROM_EMAIL      = os.getenv("FROM_EMAIL",    "compliance@chh.com.ng")
FROM_NAME       = os.getenv("FROM_NAME",     "CHH Compliance Intelligence Center")
ALWAYS_CC       = os.getenv("ALWAYS_CC",     "cto@chh.com.ng")

DEPARTMENT_RECIPIENTS = {
    "Finance":          os.getenv("DEPT_FINANCE",    "cfo@chh.com.ng").split(","),
    "Underwriting":     os.getenv("DEPT_UW",         "chief.underwriter@chi.com.ng").split(","),
    "IT & Technology":  os.getenv("DEPT_IT",         "cto@chh.com.ng").split(","),
    "Legal/Compliance": os.getenv("DEPT_LEGAL",      "company.secretary@chh.com.ng").split(","),
    "Claims":           os.getenv("DEPT_CLAIMS",     "head.claims@chh.com.ng").split(","),
    "Operations":       os.getenv("DEPT_OPS",        "coo@chh.com.ng").split(","),
}

URGENCY_COLORS = {"critical": "#dc2626", "high": "#d97706", "medium": "#2563eb", "low": "#16a34a"}


# ─── HTML Builder ─────────────────────────────────────────────────────────────
def _items_html(items):
    if not items:
        return "<p style='color:#6b7280;font-size:13px;margin:0;'>No items this week. ✓</p>"
    html = ""
    for item in items:
        color   = URGENCY_COLORS.get(item.get("urgency","low"), "#6b7280")
        depts   = ", ".join(json.loads(item.get("affected_depts","[]")))
        deadline = item.get("deadline") or "TBD"
        gap_html = ""
        if item.get("gap_detected"):
            gap_html = f"""<div style="background:#fef2f2;border-left:3px solid #ef4444;
                padding:8px 12px;margin-top:8px;border-radius:4px;font-size:12px;color:#991b1b;">
                <strong>⚑ Gap:</strong> {item.get('gap_note','')}
            </div>"""
        html += f"""
        <div style="border:1px solid #e5e7eb;border-left:4px solid {color};border-radius:8px;
                    padding:16px;margin-bottom:12px;background:#fff;">
            <div>
                <span style="background:{color}25;color:{color};font-size:10px;font-weight:700;
                             padding:2px 8px;border-radius:3px;letter-spacing:0.05em;">
                    {item.get('urgency','').upper()}
                </span>
                <h3 style="margin:6px 0 4px;font-size:14px;color:#111827;">{item.get('title','')}</h3>
                <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">{item.get('summary','')}</p>
                <div style="font-size:11px;color:#9ca3af;">
                    Deadline: <strong>{deadline}</strong> · Departments: {depts}
                </div>
            </div>
            {gap_html}
        </div>"""
    return html


def build_digest_html(items: list, gaps: list, dept: str = None) -> str:
    relevant = [i for i in items if not dept or dept in json.loads(i.get("affected_depts","[]"))]
    rel_gaps = [g for g in gaps if not dept or dept in json.loads(g.get("affected_depts","[]"))]
    critical = [i for i in relevant if i.get("urgency") == "critical"]
    week_str = datetime.now().strftime("%d %B %Y")
    dept_line = f" — <strong>{dept}</strong>" if dept else " — All Departments"

    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;max-width:680px;margin:0 auto;">

  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 36px;border-radius:12px 12px 0 0;">
    <div style="margin-bottom:12px;">
      <span style="background:linear-gradient(135deg,#c9a84c,#8b6914);color:#fff;font-weight:800;
                   font-size:14px;padding:8px 14px;border-radius:6px;display:inline-block;">CHH</span>
    </div>
    <h1 style="color:#fff;font-size:22px;margin:8px 0 4px;">Compliance Intelligence Digest</h1>
    <p style="color:#94a3b8;font-size:12px;margin:0;">Week ending {week_str}{dept_line}</p>
  </div>

  <div style="background:#fff;padding:20px 36px;border:1px solid #e5e7eb;border-top:none;
              display:flex;gap:32px;">
    <div><div style="font-size:24px;font-weight:800;color:{'#dc2626' if critical else '#16a34a'};">
      {len(critical)}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Critical</div></div>
    <div><div style="font-size:24px;font-weight:800;color:#d97706;">{len(rel_gaps)}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Gaps</div></div>
    <div><div style="font-size:24px;font-weight:800;color:#374151;">{len(relevant)}</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Total Items</div></div>
  </div>

  <div style="background:#f9fafb;padding:24px 36px;border:1px solid #e5e7eb;border-top:none;">
    {"<h2 style='font-size:13px;color:#dc2626;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;'>⚠ Critical — Immediate Action Required</h2>" + _items_html(critical) if critical else ""}
    {"<h2 style='font-size:13px;color:#d97706;text-transform:uppercase;letter-spacing:0.08em;margin:16px 0 12px;'>◈ Compliance Gaps</h2>" + _items_html(rel_gaps) if rel_gaps else ""}
    <h2 style="font-size:13px;color:#374151;text-transform:uppercase;letter-spacing:0.08em;margin:16px 0 12px;">
      All Updates
    </h2>
    {_items_html(relevant)}
  </div>

  <div style="background:#0f172a;padding:16px 36px;border-radius:0 0 12px 12px;
              font-size:11px;color:#4b5563;text-align:center;">
    Auto-generated by CHH Compliance Intelligence Center · 
    Next digest: {(datetime.now()+timedelta(weeks=1)).strftime('%d %b %Y')}
  </div>
</td></tr></table>
</body></html>"""


def build_critical_alert_html(item) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:#dc2626;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">🚨 Critical Compliance Alert</h2>
    <p style="margin:4px 0 0;font-size:12px;opacity:0.8;">CHH Compliance Intelligence Center · {datetime.now().strftime('%d %b %Y %H:%M')}</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 8px 8px;">
    <h3 style="color:#111;font-size:15px;margin:0 0 12px;">{item.title}</h3>
    <p style="color:#374151;font-size:13px;">{item.summary}</p>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px;margin-top:16px;border-radius:4px;">
      <strong style="color:#991b1b;">Action Required:</strong>
      <p style="color:#7f1d1d;font-size:13px;margin:4px 0 0;">
        {item.gap_note or 'Review immediately and assign to the responsible department.'}
      </p>
    </div>
    <p style="font-size:11px;color:#9ca3af;margin-top:16px;">Source: {item.url or 'NAICOM Portal'}</p>
  </div>
</body></html>"""


# ─── Dispatch (SendGrid) ──────────────────────────────────────────────────────
def _send_via_sendgrid(to_emails: list, subject: str, html: str, cc_emails: list = None):
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, To, Cc
        msg = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=[To(e) for e in to_emails],
            subject=subject,
            html_content=html
        )
        if cc_emails:
            msg.cc = [Cc(e) for e in cc_emails]
        sg = SendGridAPIClient(SENDGRID_KEY)
        resp = sg.send(msg)
        logger.info(f"SendGrid sent to {to_emails} — status {resp.status_code}")
    except Exception as e:
        logger.error(f"SendGrid error: {e}")


def _send_via_mailgun(to_emails: list, subject: str, html: str, cc_emails: list = None):
    try:
        import requests as req
        data = {
            "from":    f"{FROM_NAME} <{FROM_EMAIL}>",
            "to":      ", ".join(to_emails),
            "subject": subject,
            "html":    html,
        }
        if cc_emails:
            data["cc"] = ", ".join(cc_emails)
        resp = req.post(
            f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages",
            auth=("api", MAILGUN_KEY),
            data=data,
            timeout=20
        )
        logger.info(f"Mailgun sent to {to_emails} — status {resp.status_code}")
    except Exception as e:
        logger.error(f"Mailgun error: {e}")


def dispatch(to_emails: list, subject: str, html: str, cc_emails: list = None):
    if EMAIL_PROVIDER == "mailgun":
        _send_via_mailgun(to_emails, subject, html, cc_emails)
    else:
        _send_via_sendgrid(to_emails, subject, html, cc_emails)


# ─── Public API ───────────────────────────────────────────────────────────────
def send_weekly_digest():
    from database import get_all_items, get_gaps
    items = get_all_items()
    gaps  = get_gaps()
    week  = datetime.now().strftime("%d %b %Y")
    cc    = [ALWAYS_CC] if ALWAYS_CC else []

    for dept, recipients in DEPARTMENT_RECIPIENTS.items():
        dept_items = [i for i in items if dept in json.loads(i.get("affected_depts","[]"))]
        dept_gaps  = [g for g in gaps  if dept in json.loads(g.get("affected_depts","[]"))]
        if not dept_items and not dept_gaps:
            continue
        critical = sum(1 for i in dept_items if i.get("urgency")=="critical")
        subject  = f"[CHH Compliance] {'⚠ CRITICAL — ' if critical else ''}{len(dept_items)} updates · {dept} · {week}"
        html     = build_digest_html(dept_items, dept_gaps, dept=dept)
        dept_cc  = [e for e in cc if e not in recipients]
        dispatch(recipients, subject, html, dept_cc)
        logger.info(f"Digest sent → {dept}")

    # Master digest to compliance inbox
    master_html = build_digest_html(items, gaps)
    dispatch([FROM_EMAIL], f"[CHH Master Digest] {len(items)} items, {len(gaps)} gaps · {week}", master_html)
    logger.info("Master digest sent.")


def send_critical_alerts(critical_items: list):
    recipients = [ALWAYS_CC, FROM_EMAIL]
    for item in critical_items:
        subject = f"🚨 [CHH ALERT] Critical NAICOM Item: {item.title[:55]}"
        html    = build_critical_alert_html(item)
        dispatch(list(set(recipients)), subject, html)
