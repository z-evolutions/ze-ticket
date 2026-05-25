"""
System-Konfiguration API — Datenschutzerklärung, Impressum, Mail-Config etc.
GET-Endpunkte sind öffentlich (außer Mail-Config), PATCH nur für Admins.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import require_admin
from app.models.config import SystemConfig
from app.models.user import User
from app.core.crypto import encrypt, decrypt, is_encrypted

router = APIRouter(prefix="/api/config", tags=["Konfiguration"])

# ─── Öffentliche Keys (GET ohne Auth) ─────────────────────────────────────────
PUBLIC_KEYS = {"privacy_text", "imprint_text", "show_group_tiles", "ticket_visibility", "company_name", "company_street", "company_zip", "company_email", "company_phone", "company_owner", "app_name"}

# ─── Verschlüsselte Keys (Passwörter) ─────────────────────────────────────────
ENCRYPTED_KEYS = {"mail_smtp_password", "mail_imap_password", "backup_webdav_password", "backup_sftp_password", "backup_s3_secret_key"}

# ─── Alle bekannten Keys mit Defaults ─────────────────────────────────────────
DEFAULTS = {
    # Texte
    "privacy_text": """<h3>1. Verantwortliche Stelle</h3>
<p>Bitte tragen Sie hier Ihre Kontaktdaten ein.</p>
<h3>2. Welche Daten wir verarbeiten</h3>
<p>Im Rahmen Ihrer Support-Anfrage verarbeiten wir: Vorname, Nachname, E-Mail-Adresse sowie den Inhalt Ihrer Anfrage.</p>
<h3>3. Zweck und Rechtsgrundlage</h3>
<p>Ihre Daten werden ausschließlich zur Bearbeitung Ihrer Support-Anfrage verwendet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>
<h3>4. Speicherdauer</h3>
<p>Aktivitätsprotokolle werden automatisch nach 90 Tagen gelöscht. Auf Anfrage werden Ihre Daten gemäß Art. 17 DSGVO anonymisiert.</p>
<h3>5. Ihre Rechte</h3>
<p>Sie haben das Recht auf Auskunft, Berichtigung und Löschung Ihrer Daten (Art. 15–18 DSGVO). Eine Selbstlöschung ist direkt im Portal möglich.</p>
<h3>6. Technische Informationen</h3>
<p>Dieses System verwendet ausschließlich technisch notwendige Speichermechanismen (localStorage). Es werden keine Tracking-Cookies gesetzt und keine Daten an Dritte weitergegeben.</p>
<h3>7. Kontakt</h3>
<p>Bei Fragen zum Datenschutz wenden Sie sich bitte an den Betreiber dieses Systems.</p>""",

    "imprint_text": """<h3>Angaben gemäß § 5 TMG</h3>
<p>Bitte tragen Sie hier Ihre Pflichtangaben ein:<br>
Name / Firma<br>
Straße, Hausnummer<br>
PLZ, Ort</p>
<h3>Kontakt</h3>
<p>E-Mail: ihre@email.de</p>
<h3>Verantwortlich für den Inhalt</h3>
<p>Name, Adresse wie oben</p>""",

    # Mail — SMTP
    "mail_smtp_host":      "",
    "mail_smtp_port":      "465",
    "mail_smtp_user":      "",
    "mail_smtp_password":  "",   # verschlüsselt gespeichert
    "mail_smtp_from":      "",
    "mail_smtp_from_name": "ZE-Ticket Support",
    "mail_smtp_ssl":       "true",   # "true" = SSL, "false" = STARTTLS

    # Mail — IMAP
    "mail_imap_host":     "",
    "mail_imap_port":     "993",
    "mail_imap_user":     "",
    "mail_imap_password": "",   # verschlüsselt gespeichert
    "mail_imap_ssl":      "true",

    # Mail — Schalter
    "mail_imap_enabled":  "false",  # IMAP-Polling ein/aus

    # App
    "app_name": "",

    # Betreiber-Daten
    "company_name":    "",
    "company_street":  "",
    "company_zip":     "",
    "company_email":   "",
    "company_phone":   "",
    "company_owner":   "",

    # Ticket-Sichtbarkeit
    "ticket_visibility": "own_and_unassigned",  # all | own_and_unassigned | own_group
    "show_group_tiles":  "true",               # Gruppen-Kacheln im Dashboard  # all | own_and_unassigned | own_group

    # Backup
    "backup_enabled":          "false",
    "backup_target":           "local",   # local | webdav | sftp | s3
    "backup_schedule_hour":    "2",       # Stunde (0-23, UTC)
    "backup_retention_days":   "30",
    "backup_retention_min":    "7",
    "backup_include_uploads":  "true",
    "backup_compress":         "true",
    # Backup — Lokal
    "backup_local_path":       "/app/backups",
    # Backup — WebDAV
    "backup_webdav_url":       "",
    "backup_webdav_user":      "",
    "backup_webdav_password":  "",
    "backup_webdav_path":      "/backups",
    # Backup — SFTP
    "backup_sftp_host":        "",
    "backup_sftp_port":        "22",
    "backup_sftp_user":        "",
    "backup_sftp_password":    "",
    "backup_sftp_path":        "/backups",
    # Backup — S3
    "backup_s3_endpoint":      "",
    "backup_s3_bucket":        "",
    "backup_s3_region":        "auto",
    "backup_s3_access_key":    "",
    "backup_s3_secret_key":    "",
    "backup_s3_path":          "backups",
}


async def get_config_value(db: AsyncSession, key: str) -> str:
    """Liest einen Konfigurationswert aus der DB. Passwörter werden entschlüsselt."""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    cfg = result.scalar_one_or_none()
    if cfg and cfg.value:
        if key in ENCRYPTED_KEYS and is_encrypted(cfg.value):
            return decrypt(cfg.value)
        return cfg.value
    return DEFAULTS.get(key, "")


async def set_config_value(db: AsyncSession, key: str, value: str) -> None:
    """Schreibt einen Konfigurationswert in die DB. Passwörter werden verschlüsselt."""
    if key in ENCRYPTED_KEYS and value and not is_encrypted(value):
        value = encrypt(value)

    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    cfg = result.scalar_one_or_none()
    if cfg:
        cfg.value = value
    else:
        cfg = SystemConfig(key=key, value=value)
        db.add(cfg)



# ─── GET /api/config/dashboard ───────────────────────────────────────────────
@router.get("/dashboard")
async def get_dashboard_config(db: AsyncSession = Depends(get_db)):
    """Dashboard-Konfiguration abrufen — öffentlich."""
    return {
        "show_group_tiles": await get_config_value(db, "show_group_tiles"),
        "ticket_visibility": await get_config_value(db, "ticket_visibility"),
    }

# ─── GET /api/config/company ──────────────────────────────────────────────────
@router.get("/company")
async def get_company_config(db: AsyncSession = Depends(get_db)):
    """Betreiber-Daten abrufen — öffentlich."""
    return {
        "company_name":   await get_config_value(db, "company_name"),
        "company_street": await get_config_value(db, "company_street"),
        "company_zip":    await get_config_value(db, "company_zip"),
        "company_email":  await get_config_value(db, "company_email"),
        "company_phone":  await get_config_value(db, "company_phone"),
        "company_owner":  await get_config_value(db, "company_owner"),
    }


async def get_company_vars(db) -> dict:
    """Gibt Betreiber-Variablen mit deutschen UND englischen Namen zurück."""
    name   = await get_config_value(db, "company_name")
    street = await get_config_value(db, "company_street")
    zip_   = await get_config_value(db, "company_zip")
    email  = await get_config_value(db, "company_email")
    phone  = await get_config_value(db, "company_phone")
    owner  = await get_config_value(db, "company_owner")
    return {
        # Deutsche Namen
        "firma":   name,   "inhaber": owner,
        "strasse": street, "ort":     zip_,
        "email":   email,  "telefon": phone,
        # Englische Namen (Rückwärtskompatibilität)
        "company_name":   name,   "company_owner":  owner,
        "company_street": street, "company_zip":    zip_,
        "company_email":  email,  "company_phone":  phone,
    }


# ─── GET /api/config/{key} — öffentlich (nur PUBLIC_KEYS) ─────────────────────
@router.get("/{key}")
async def get_config(key: str, db: AsyncSession = Depends(get_db)):
    """Konfigurationswert abrufen — nur öffentliche Keys."""
    if key not in PUBLIC_KEYS:
        raise HTTPException(status_code=404, detail="Konfigurationsschlüssel nicht gefunden.")
    value = await get_config_value(db, key)
    return {"key": key, "value": value}


# ─── GET /api/config/{key}/rendered — öffentlich, Variablen ersetzt ────────────
@router.get("/{key}/rendered")
async def get_config_rendered(key: str, db: AsyncSession = Depends(get_db)):
    """Konfigurationswert mit ersetzten Betreiber-Variablen — für Modals."""
    if key not in PUBLIC_KEYS:
        raise HTTPException(status_code=404, detail="Konfigurationsschlüssel nicht gefunden.")
    value = await get_config_value(db, key)
    if key in ("privacy_text", "imprint_text") and value:
        company_vars = await get_company_vars(db)
        value = render_template(value, company_vars)
    return {"key": key, "value": value}


# ─── PATCH /api/config/{key} — nur Admins ─────────────────────────────────────
class ConfigUpdate(BaseModel):
    value: str

@router.patch("/{key}")
async def update_config(
    key: str,
    data: ConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Konfigurationswert aktualisieren — nur Admins."""
    if key not in DEFAULTS:
        raise HTTPException(status_code=404, detail="Konfigurationsschlüssel nicht gefunden.")

    await set_config_value(db, key, data.value)
    await db.commit()
    return {"key": key, "saved": True}

# ─── E-Mail Template Defaults ─────────────────────────────────────────────────

TEMPLATE_DEFAULTS = {
    "tpl_invitation": """<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Einladung zu {{app_name}}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#0a0f1e; color:#e0e0e0; padding:20px; }
.wrapper { max-width:600px; margin:0 auto; }
.header { background:linear-gradient(135deg,#0d1b3e,#0a1628); border:1px solid #00d4ff; border-bottom:none; border-radius:8px 8px 0 0; padding:30px; text-align:center; }
.header h1 { font-family:'Courier New',monospace; font-size:24px; color:#00d4ff; letter-spacing:4px; text-transform:uppercase; }
.header p { color:#7ab8d4; font-size:12px; margin-top:6px; letter-spacing:2px; }
.body { background:#0d1b3e; border:1px solid #00d4ff33; border-top:none; border-bottom:none; padding:36px 40px; }
.body p { line-height:1.7; color:#c8d8e8; margin-bottom:16px; }
.highlight-box { background:#0a1628; border:1px solid #00d4ff55; border-left:4px solid #00d4ff; border-radius:4px; padding:20px 24px; margin:24px 0; font-family:'Courier New',monospace; font-size:18px; color:#00d4ff; letter-spacing:3px; text-align:center; }
.btn { display:inline-block; background:linear-gradient(135deg,#00d4ff,#0099cc); color:#0a0f1e !important; text-decoration:none; font-weight:bold; font-family:'Courier New',monospace; letter-spacing:2px; padding:14px 32px; border-radius:4px; font-size:14px; text-transform:uppercase; }
.btn-wrapper { text-align:center; margin:28px 0; }
.footer { background:#070d1a; border:1px solid #00d4ff22; border-top:none; border-radius:0 0 8px 8px; padding:20px 40px; text-align:center; font-size:11px; color:#4a6080; line-height:1.6; }
.footer a { color:#00d4ff88; text-decoration:none; }
</style></head>
<body><div class="wrapper">
<div class="header"><h1>{{app_name}}</h1><p>Support System</p></div>
<div class="body">
<p>Hallo <strong style="color:#00d4ff;">{{display_name}}</strong>,</p>
<p>du wurdest zum <strong>{{app_name}} Support-System</strong> eingeladen. Dein Account wurde mit der Rolle <strong style="color:#00d4ff;">{{role}}</strong> angelegt.</p>
<p>Dein temporäres Einmalpasswort lautet:</p>
<div class="highlight-box">{{onboarding_password}}</div>
<p>Klicke auf den Button um dich anzumelden. Du wirst beim ersten Login aufgefordert, ein eigenes Passwort zu vergeben.</p>
<div class="btn-wrapper"><a href="{{login_url}}" class="btn">&#9654; Jetzt anmelden</a></div>
<p style="font-size:13px;color:#4a6080;">⚠️ Dieses Passwort ist nur einmalig gültig und wird nach der ersten Anmeldung deaktiviert. Bitte gib es nicht weiter.</p>
</div>
<div class="footer"><p>Diese E-Mail wurde automatisch generiert — bitte nicht direkt antworten.</p></div>
</div></body></html>""",

    "tpl_password_reset": """<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Passwort zurücksetzen — {{app_name}}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#0a0f1e; color:#e0e0e0; padding:20px; }
.wrapper { max-width:600px; margin:0 auto; }
.header { background:linear-gradient(135deg,#0d1b3e,#0a1628); border:1px solid #00d4ff; border-bottom:none; border-radius:8px 8px 0 0; padding:30px; text-align:center; }
.header h1 { font-family:'Courier New',monospace; font-size:24px; color:#00d4ff; letter-spacing:4px; text-transform:uppercase; }
.body { background:#0d1b3e; border:1px solid #00d4ff33; border-top:none; border-bottom:none; padding:36px 40px; }
.body p { line-height:1.7; color:#c8d8e8; margin-bottom:16px; }
.btn { display:inline-block; background:linear-gradient(135deg,#00d4ff,#0099cc); color:#0a0f1e !important; text-decoration:none; font-weight:bold; font-family:'Courier New',monospace; letter-spacing:2px; padding:14px 32px; border-radius:4px; font-size:14px; text-transform:uppercase; }
.btn-wrapper { text-align:center; margin:28px 0; }
.footer { background:#070d1a; border:1px solid #00d4ff22; border-top:none; border-radius:0 0 8px 8px; padding:20px 40px; text-align:center; font-size:11px; color:#4a6080; }
</style></head>
<body><div class="wrapper">
<div class="header"><h1>{{app_name}}</h1></div>
<div class="body">
<p>Hallo <strong style="color:#00d4ff;">{{display_name}}</strong>,</p>
<p>wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke auf den Button um ein neues Passwort zu vergeben:</p>
<div class="btn-wrapper"><a href="{{reset_url}}" class="btn">&#9654; Passwort zurücksetzen</a></div>
<p style="font-size:13px;color:#4a6080;">Dieser Link ist <strong>{{expires_minutes}} Minuten</strong> gültig.<br>Falls du kein Passwort-Reset angefordert hast, kannst du diese E-Mail ignorieren.</p>
</div>
<div class="footer"><p>Diese E-Mail wurde automatisch generiert — bitte nicht direkt antworten.</p></div>
</div></body></html>""",

    "tpl_ticket_confirmation": """<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Ihre Anfrage ist eingegangen</title>
<style>
body { font-family:Arial,sans-serif; background:#f8faff; color:#333; padding:20px; }
.wrapper { max-width:600px; margin:0 auto; }
.header { background:#0a0f1e; padding:20px; border-bottom:2px solid #00d4ff; border-radius:8px 8px 0 0; }
.header h1 { color:#00d4ff; font-size:1.2rem; margin:0; }
.body { background:#fff; padding:28px 32px; border:1px solid #e0e8ff; border-top:none; border-bottom:none; }
.body p { line-height:1.7; margin-bottom:14px; }
.ticket-box { background:#f8faff; border:1px solid #e0e8ff; border-left:4px solid #00d4ff; padding:16px; margin:20px 0; border-radius:4px; }
.ticket-number { font-family:monospace; font-size:1.1rem; font-weight:bold; color:#0a0f1e; }
.footer { background:#f0f4ff; border:1px solid #e0e8ff; border-top:none; border-radius:0 0 8px 8px; padding:16px 32px; font-size:11px; color:#999; }
</style></head>
<body><div class="wrapper">
<div class="header"><h1>{{app_name}} Support</h1></div>
<div class="body">
<p>Hallo {{to_name}},</p>
<p>vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und bearbeiten sie so schnell wie möglich.</p>
<div class="ticket-box">
<p style="margin:0;color:#666;font-size:0.85rem;">TICKET-NUMMER</p>
<p class="ticket-number">{{ticket_number}}</p>
<p style="margin:8px 0 0 0;color:#444;">{{ticket_subject}}</p>
</div>
<p style="color:#666;font-size:0.9rem;">Bitte antworten Sie auf diese E-Mail wenn Sie weitere Informationen hinzufügen möchten. Ihre Antwort wird automatisch dem Ticket zugeordnet.</p>
</div>
<div class="footer"><p>{{app_name}} — {{app_url}}</p></div>
</div></body></html>""",

    "tpl_comment_notification": """<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Neue Antwort auf Ihr Ticket</title>
<style>
body { font-family:Arial,sans-serif; background:#f8faff; color:#333; padding:20px; }
.wrapper { max-width:600px; margin:0 auto; }
.header { background:#0a0f1e; padding:20px; border-bottom:2px solid #00d4ff; border-radius:8px 8px 0 0; }
.header h1 { color:#00d4ff; font-size:1.2rem; margin:0; }
.body { background:#fff; padding:28px 32px; border:1px solid #e0e8ff; border-top:none; border-bottom:none; }
.body p { line-height:1.7; margin-bottom:14px; }
.comment-box { background:#f8faff; border:1px solid #e0e8ff; border-left:4px solid #00d4ff; padding:16px; margin:20px 0; border-radius:4px; white-space:pre-wrap; }
.footer { background:#f0f4ff; border:1px solid #e0e8ff; border-top:none; border-radius:0 0 8px 8px; padding:16px 32px; font-size:11px; color:#999; }
</style></head>
<body><div class="wrapper">
<div class="header"><h1>{{app_name}} Support</h1></div>
<div class="body">
<p>Hallo {{to_name}},</p>
<p><strong>{{agent_name}}</strong> hat Ihr Ticket <strong>{{ticket_number}}</strong> beantwortet:</p>
<div class="comment-box">{{comment_body}}</div>
<p style="color:#666;font-size:0.9rem;">Bitte antworten Sie auf diese E-Mail um zu antworten. Ihre Antwort wird automatisch dem Ticket zugeordnet.</p>
</div>
<div class="footer"><p>{{app_name}} — Ticket {{ticket_number}} — {{app_url}}</p></div>
</div></body></html>""",

    "tpl_sla_breach": """<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>SLA-Verletzung — {{ticket_number}}</title>
<style>
body { font-family:Arial,sans-serif; background:#f8faff; color:#333; padding:20px; }
.wrapper { max-width:600px; margin:0 auto; }
.header { background:#0a0f1e; padding:20px; border-bottom:2px solid #ef4444; border-radius:8px 8px 0 0; }
.header h1 { color:#ef4444; font-size:1.2rem; margin:0; }
.body { background:#fff; padding:28px 32px; border:1px solid #fecaca; border-top:none; border-bottom:none; }
.body p { line-height:1.7; margin-bottom:14px; }
.alert-box { background:#fff5f5; border:1px solid #fecaca; border-left:4px solid #ef4444; padding:16px; margin:20px 0; border-radius:4px; }
.btn { display:inline-block; background:#ef4444; color:#fff !important; text-decoration:none; font-weight:bold; padding:12px 28px; border-radius:4px; font-size:14px; }
.btn-wrapper { text-align:center; margin:24px 0; }
.footer { background:#fff5f5; border:1px solid #fecaca; border-top:none; border-radius:0 0 8px 8px; padding:16px 32px; font-size:11px; color:#999; }
</style></head>
<body><div class="wrapper">
<div class="header"><h1>⚠️ SLA-Verletzung — {{app_name}}</h1></div>
<div class="body">
<p>Hallo {{display_name}},</p>
<p>die SLA-Frist für folgendes Ticket wurde überschritten:</p>
<div class="alert-box">
<strong>{{ticket_number}}</strong><br>
{{ticket_subject}}<br>
<span style="color:#ef4444;">Fällig war: {{due_at}}</span>
</div>
<p>Bitte bearbeite dieses Ticket umgehend.</p>
<div class="btn-wrapper"><a href="{{app_url}}/tickets" class="btn">Zum Ticket-System</a></div>
</div>
<div class="footer"><p>{{app_name}} — {{app_url}}</p></div>
</div></body></html>""",
}


async def get_template(db: AsyncSession, key: str) -> str:
    """Template aus DB lesen — Fallback auf TEMPLATE_DEFAULTS."""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    cfg = result.scalar_one_or_none()
    if cfg and cfg.value:
        return cfg.value
    return TEMPLATE_DEFAULTS.get(key, "")


def render_template(template: str, variables: dict) -> str:
    """Einfaches Template-Rendering mit {{variable}} Syntax."""
    for key, value in variables.items():
        template = template.replace(f"{{{{{key}}}}}", str(value) if value is not None else "")
    return template

