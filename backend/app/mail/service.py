"""
Mail-Service — sendet alle System-E-Mails.
Templates werden aus der DB geladen (Fallback: TEMPLATE_DEFAULTS).
"""
from app.mail.client import send_email
from app.core.database import AsyncSessionLocal
from app.api.config import get_template, render_template
from app.core.config import settings


async def _send_template(
    to_email: str,
    subject: str,
    template_key: str,
    variables: dict,
    plain: str,
) -> None:
    """Hilfsfunktion: Template laden, rendern, senden."""
    async with AsyncSessionLocal() as db:
        template = await get_template(db, template_key)

    # Globale Variablen immer verfügbar
    variables.setdefault("app_name", settings.APP_NAME)
    variables.setdefault("app_url", settings.APP_URL)

    html = render_template(template, variables)

    await send_email(
        to_email=to_email,
        subject=subject,
        html_body=html,
        plain_body=plain,
    )


async def send_invitation_mail(
    to_email: str,
    display_name: str,
    role: str,
    onboarding_password: str,
) -> None:
    login_url = f"{settings.APP_URL}/login"
    await _send_template(
        to_email=to_email,
        subject=f"Einladung zu {settings.APP_NAME}",
        template_key="tpl_invitation",
        variables={
            "display_name":        display_name,
            "role":                role,
            "onboarding_password": onboarding_password,
            "login_url":           login_url,
        },
        plain=(
            f"Hallo {display_name},\n\n"
            f"du wurdest zu {settings.APP_NAME} eingeladen (Rolle: {role}).\n\n"
            f"Dein temporäres Einmalpasswort: {onboarding_password}\n\n"
            f"Anmelden unter: {login_url}\n\n"
            f"Das Passwort ist nur einmalig gültig.\n\n"
            f"-- {settings.APP_NAME}"
        ),
    )


async def send_password_reset_mail(
    to_email: str,
    display_name: str,
    reset_token: str,
    expires_minutes: int = 30,
) -> None:
    reset_url = f"{settings.APP_URL}/reset-password?token={reset_token}"
    await _send_template(
        to_email=to_email,
        subject=f"Passwort zurücksetzen — {settings.APP_NAME}",
        template_key="tpl_password_reset",
        variables={
            "display_name":    display_name,
            "reset_url":       reset_url,
            "expires_minutes": expires_minutes,
        },
        plain=(
            f"Hallo {display_name},\n\n"
            f"Passwort zurücksetzen: {reset_url}\n\n"
            f"Der Link ist {expires_minutes} Minuten gültig.\n\n"
            f"Falls du keinen Reset angefordert hast, ignoriere diese Mail.\n\n"
            f"-- {settings.APP_NAME}"
        ),
    )


async def send_ticket_confirmation(
    to_email: str,
    to_name: str,
    ticket_number: str,
    ticket_subject: str,
) -> None:
    await _send_template(
        to_email=to_email,
        subject=f"[{ticket_number}] Ihre Anfrage ist eingegangen — {ticket_subject}",
        template_key="tpl_ticket_confirmation",
        variables={
            "to_name":        to_name,
            "ticket_number":  ticket_number,
            "ticket_subject": ticket_subject,
        },
        plain=(
            f"Hallo {to_name},\n\n"
            f"Ihre Anfrage ist eingegangen.\n\n"
            f"Ticket: {ticket_number}\n"
            f"Betreff: {ticket_subject}\n\n"
            f"Bitte antworten Sie auf diese E-Mail um weitere Informationen hinzuzufügen.\n\n"
            f"-- {settings.APP_NAME}"
        ),
    )


async def send_comment_notification(
    to_email: str,
    to_name: str,
    ticket_number: str,
    ticket_subject: str,
    agent_name: str,
    comment_body: str,
) -> None:
    await _send_template(
        to_email=to_email,
        subject=f"[{ticket_number}] Neue Antwort — {ticket_subject}",
        template_key="tpl_comment_notification",
        variables={
            "to_name":        to_name,
            "ticket_number":  ticket_number,
            "ticket_subject": ticket_subject,
            "agent_name":     agent_name,
            "comment_body":   comment_body,
        },
        plain=(
            f"Hallo {to_name},\n\n"
            f"{agent_name} hat Ihr Ticket {ticket_number} beantwortet:\n\n"
            f"{comment_body}\n\n"
            f"Bitte antworten Sie auf diese E-Mail.\n\n"
            f"-- {settings.APP_NAME}"
        ),
    )


async def send_portal_ticket_confirmation(
    to_email: str,
    to_name: str,
    ticket_number: str,
    ticket_subject: str,
    portal_password: str | None = None,
) -> None:
    login_url = f"{settings.APP_URL}/login"
    password_section = ""
    password_plain = ""

    if portal_password:
        password_section = f"""
        <div style="background:#fff;border:1px solid #e0e8ff;border-left:4px solid #00d4ff;
                    padding:16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;color:#666;font-size:0.85rem;">IHR PORTAL-PASSWORT</p>
          <p style="margin:4px 0 0 0;font-size:1.1rem;font-weight:bold;
                    color:#0a0f1e;font-family:monospace;">{portal_password}</p>
        </div>
        <p><strong>Login:</strong> {to_email} + Ticket-Nummer + obiges Passwort</p>"""
        password_plain = f"\nIhr Portal-Passwort: {portal_password}\nLogin: {to_email} | Ticket: {ticket_number}\n"

    # Portal-Bestätigung nutzt eigenes Inline-Template (enthält dynamische Passwort-Sektion)
    html = f"""<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8">
<style>
body{{font-family:Arial,sans-serif;background:#f8faff;color:#333;padding:20px;}}
.wrapper{{max-width:600px;margin:0 auto;}}
.header{{background:#0a0f1e;padding:20px;border-bottom:2px solid #00d4ff;border-radius:8px 8px 0 0;}}
.header h1{{color:#00d4ff;font-size:1.2rem;margin:0;}}
.body{{background:#fff;padding:28px 32px;border:1px solid #e0e8ff;border-top:none;border-bottom:none;}}
.body p{{line-height:1.7;margin-bottom:14px;}}
.ticket-box{{background:#f8faff;border:1px solid #e0e8ff;border-left:4px solid #00d4ff;padding:16px;margin:20px 0;border-radius:4px;}}
.footer{{background:#f0f4ff;border:1px solid #e0e8ff;border-top:none;border-radius:0 0 8px 8px;padding:16px 32px;font-size:11px;color:#999;}}
</style></head>
<body><div class="wrapper">
<div class="header"><h1>{settings.APP_NAME} Support</h1></div>
<div class="body">
<p>Hallo {to_name},</p>
<p>Ihre Support-Anfrage ist eingegangen. Wir bearbeiten sie so schnell wie möglich.</p>
<div class="ticket-box">
<p style="margin:0;color:#666;font-size:0.85rem;">TICKET-NUMMER</p>
<p style="margin:4px 0 0 0;font-size:1.1rem;font-weight:bold;font-family:monospace;">{ticket_number}</p>
<p style="margin:8px 0 0 0;color:#444;">{ticket_subject}</p>
</div>
{password_section}
<a href="{login_url}" style="display:inline-block;background:#00d4ff;color:#0a0f1e;
   padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold;">Zum Portal →</a>
</div>
<div class="footer"><p>{settings.APP_NAME} — {settings.APP_URL}</p></div>
</div></body></html>"""

    subject = f"[{ticket_number}] Ihre Anfrage ist eingegangen — {ticket_subject}"
    if portal_password:
        subject += " (inkl. Zugangsdaten)"

    await send_email(
        to_email=to_email,
        subject=subject,
        html_body=html,
        plain_body=(
            f"Hallo {to_name},\n\nIhre Anfrage ist eingegangen.\n\n"
            f"Ticket: {ticket_number}\nBetreff: {ticket_subject}\n"
            f"{password_plain}\nPortal: {login_url}\n\n-- {settings.APP_NAME}"
        ),
    )


async def send_sla_breach_mail(
    to_email: str,
    display_name: str,
    ticket_number: str,
    ticket_subject: str,
    due_at,
) -> None:
    due_str = due_at.strftime("%d.%m.%Y %H:%M") if due_at else "unbekannt"
    await _send_template(
        to_email=to_email,
        subject=f"⚠️ SLA verletzt: {ticket_number}",
        template_key="tpl_sla_breach",
        variables={
            "display_name":   display_name,
            "ticket_number":  ticket_number,
            "ticket_subject": ticket_subject,
            "due_at":         due_str,
        },
        plain=(
            f"Hallo {display_name},\n\n"
            f"SLA-Frist überschritten für Ticket {ticket_number}:\n"
            f"{ticket_subject}\nFällig war: {due_str}\n\n"
            f"Bitte bearbeite dieses Ticket umgehend.\n\n"
            f"-- {settings.APP_NAME}"
        ),
    )
