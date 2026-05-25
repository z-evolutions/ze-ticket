"""
Admin-API — Stats, Audit-Log, System-Einstellungen, E-Mail-Config, SLA-Verwaltung.
Nur für Admins und Superadmins zugänglich.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.core.audit import log_action
from app.auth.dependencies import get_current_user, require_admin
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus
from app.models.audit import AuditLog
from app.models.sla import SLA, SLAPriorityScope
from app.models.group import Group

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ─── GET /api/admin/stats ─────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Erweiterte System-Statistiken für den Adminbereich."""
    async def count(model, filter=None):
        stmt = select(func.count(model.id))
        if filter is not None:
            stmt = stmt.where(filter)
        return (await db.execute(stmt)).scalar()

    return {
        "users": {
            "total":    await count(User),
            "active":   await count(User, User.is_active == True),
            "agents":   await count(User, User.role.in_([UserRole.AGENT, UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN])),
            "kunden":   await count(User, User.role == UserRole.KUNDE),
        },
        "tickets": {
            "total":          await count(Ticket),
            "neu":            await count(Ticket, Ticket.status == TicketStatus.NEU),
            "in_bearbeitung": await count(Ticket, Ticket.status == TicketStatus.IN_BEARBEITUNG),
            "geloest":        await count(Ticket, Ticket.status == TicketStatus.GELOEST),
            "geschlossen":    await count(Ticket, Ticket.status == TicketStatus.GESCHLOSSEN),
            "sla_breached":   await count(Ticket, Ticket.sla_breached == True),
        },
        "groups": {
            "total":  await count(Group),
            "active": await count(Group, Group.is_active == True),
        },
        "slas": {
            "total":  await count(SLA),
            "active": await count(SLA, SLA.is_active == True),
        },
    }


# ─── GET /api/admin/audit-log ─────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Audit-Log abrufen mit Paginierung und Filter."""
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar()

    stmt = stmt.order_by(desc(AuditLog.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    entries = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "entries": [
            {
                "id": str(e.id),
                "action": e.action,
                "user_display_name": e.user_display_name,
                "resource_type": e.resource_type,
                "resource_id": e.resource_id,
                "resource_label": e.resource_label,
                "detail": e.detail,
                "ip_address": e.ip_address,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ]
    }


# ─── SLA CRUD ─────────────────────────────────────────────────────────────────

class SLACreate(BaseModel):
    name: str
    description: Optional[str] = None
    response_time_minutes: int
    resolution_time_minutes: int
    priority_scope: SLAPriorityScope = SLAPriorityScope.ALLE
    group_id: Optional[UUID] = None
    is_public: bool = False
    is_active: bool = True

class SLAUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    response_time_minutes: Optional[int] = None
    resolution_time_minutes: Optional[int] = None
    priority_scope: Optional[SLAPriorityScope] = None
    group_id: Optional[UUID] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None


@router.get("/slas")
async def list_slas(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(SLA).options(selectinload(SLA.group)).order_by(SLA.created_at)
    )
    slas = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "description": s.description,
            "response_time_minutes": s.response_time_minutes,
            "resolution_time_minutes": s.resolution_time_minutes,
            "priority_scope": s.priority_scope,
            "group_id": str(s.group_id) if s.group_id else None,
            "group_name": s.group.name if s.group else None,
            "is_public": s.is_public,
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat(),
        }
        for s in slas
    ]


@router.post("/slas", status_code=201)
async def create_sla(
    request: Request,
    data: SLACreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    sla = SLA(**data.model_dump())
    db.add(sla)
    await db.commit()
    await db.refresh(sla)
    await log_action(db, user=current_user, action="sla.created",
        resource_type="sla", resource_id=str(sla.id),
        resource_label=sla.name, request=request)
    return {"id": str(sla.id), "name": sla.name}


@router.patch("/slas/{sla_id}")
async def update_sla(
    sla_id: UUID,
    request: Request,
    data: SLAUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(SLA).where(SLA.id == sla_id))
    sla = result.scalar_one_or_none()
    if not sla:
        raise HTTPException(status_code=404, detail="SLA nicht gefunden.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sla, field, value)
    await db.commit()
    await log_action(db, user=current_user, action="sla.updated",
        resource_type="sla", resource_id=str(sla.id),
        resource_label=sla.name, request=request)
    return {"detail": "SLA aktualisiert."}


@router.delete("/slas/{sla_id}")
async def delete_sla(
    sla_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(SLA).where(SLA.id == sla_id))
    sla = result.scalar_one_or_none()
    if not sla:
        raise HTTPException(status_code=404, detail="SLA nicht gefunden.")
    await db.delete(sla)
    await db.commit()
    await log_action(db, user=current_user, action="sla.deleted",
        resource_type="sla", resource_id=str(sla_id),
        resource_label=sla.name, request=request)
    return {"detail": "SLA gelöscht."}


# ─── GET /api/admin/settings ──────────────────────────────────────────────────

@router.get("/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """System-Einstellungen abrufen."""
    from app.api.config import get_config_value
    db_app_name = await get_config_value(db, "app_name")
    return {
        "app_name": db_app_name or settings.APP_NAME,
        "app_url":  settings.APP_URL,
        "app_env":  settings.APP_ENV,
    }


# ─── DELETE /api/admin/users/{user_id}/anonymize ──────────────────────────────

@router.post("/users/{user_id}/anonymize")
async def anonymize_user(
    user_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Admin anonymisiert einen Benutzer auf DSGVO-Anfrage.
    Nur für Admins/Superadmins — nicht für sich selbst anwendbar.
    """
    import secrets
    import os

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden.")

    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Sie können sich nicht selbst anonymisieren.")

    if target.role in [UserRole.SUPERADMIN] and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Keine Berechtigung.")

    user_id_str = str(target.id)
    display_name_snapshot = target.display_name
    email_snapshot = target.email

    # Avatar-Datei löschen
    if target.avatar_url:
        avatar_path = f"/app{target.avatar_url}"
        if os.path.exists(avatar_path):
            os.remove(avatar_path)

    # Anonymisierung
    target.email          = f"deleted-{user_id_str}@deleted.invalid"
    target.display_name   = "Gelöschter Nutzer"
    target.full_name      = None
    target.avatar_url     = None
    target.hashed_password = secrets.token_hex(32)
    target.is_active      = False
    target.gravatar_email = None

    await db.commit()

    await log_action(
        db=db,
        action="user.anonymized_by_admin",
        user=current_user,
        resource_type="user",
        resource_id=user_id_str,
        resource_label=display_name_snapshot,
        detail=f"Benutzer {email_snapshot} auf DSGVO-Anfrage anonymisiert durch {current_user.display_name}",
        request=request,
    )

    return {"detail": f"Benutzer wurde anonymisiert."}


# ─── POST /api/admin/logo ─────────────────────────────────────────────────────

@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
):
    """Logo hochladen — max. 2MB, nur Bilder."""
    import os

    allowed = {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Nur JPEG, PNG, WebP oder SVG erlaubt.")

    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Datei zu groß. Maximum: 2MB.")

    # Altes Logo löschen
    logo_dir = "/app/uploads/logo"
    os.makedirs(logo_dir, exist_ok=True)
    for f in os.listdir(logo_dir):
        os.remove(os.path.join(logo_dir, f))

    # Neues Logo speichern
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    filename = f"logo.{ext}"
    filepath = os.path.join(logo_dir, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    return {"logo_url": f"/uploads/logo/{filename}"}


@router.get("/logo")
async def get_logo():
    """Aktuelles Logo abrufen — öffentlich zugänglich."""
    import os
    logo_dir = "/app/uploads/logo"
    if os.path.exists(logo_dir):
        files = os.listdir(logo_dir)
        if files:
            return {"logo_url": f"/uploads/logo/{files[0]}"}
    return {"logo_url": None}

# ─── GET /api/admin/mail-config ───────────────────────────────────────────────
@router.get("/mail-config")
async def get_mail_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Mail-Konfiguration abrufen — Passwörter werden maskiert."""
    from app.api.config import get_config_value

    async def val(key): return await get_config_value(db, key)

    return {
        "smtp": {
            "host":      await val("mail_smtp_host"),
            "port":      await val("mail_smtp_port"),
            "user":      await val("mail_smtp_user"),
            "password":  "••••••••" if await val("mail_smtp_password") else "",
            "from_email": await val("mail_smtp_from"),
            "from_name": await val("mail_smtp_from_name"),
            "ssl":       await val("mail_smtp_ssl"),
        },
        "imap": {
            "host":     await val("mail_imap_host"),
            "port":     await val("mail_imap_port"),
            "user":     await val("mail_imap_user"),
            "password": "••••••••" if await val("mail_imap_password") else "",
            "ssl":      await val("mail_imap_ssl"),
            "enabled":  await val("mail_imap_enabled"),
        },
    }


# ─── PATCH /api/admin/mail-config ─────────────────────────────────────────────
class MailConfigUpdate(BaseModel):
    smtp_host:      Optional[str] = None
    smtp_port:      Optional[str] = None
    smtp_user:      Optional[str] = None
    smtp_password:  Optional[str] = None
    smtp_from:      Optional[str] = None
    smtp_from_name: Optional[str] = None
    smtp_ssl:       Optional[str] = None
    imap_host:      Optional[str] = None
    imap_port:      Optional[str] = None
    imap_user:      Optional[str] = None
    imap_password:  Optional[str] = None
    imap_ssl:       Optional[str] = None
    imap_enabled:   Optional[str] = None

@router.patch("/mail-config")
async def update_mail_config(
    data: MailConfigUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Mail-Konfiguration aktualisieren."""
    from app.api.config import set_config_value

    mapping = {
        "mail_smtp_host":      data.smtp_host,
        "mail_smtp_port":      data.smtp_port,
        "mail_smtp_user":      data.smtp_user,
        "mail_smtp_password":  data.smtp_password,
        "mail_smtp_from":      data.smtp_from,
        "mail_smtp_from_name": data.smtp_from_name,
        "mail_smtp_ssl":       data.smtp_ssl,
        "mail_imap_host":      data.imap_host,
        "mail_imap_port":      data.imap_port,
        "mail_imap_user":      data.imap_user,
        "mail_imap_password":  data.imap_password,
        "mail_imap_ssl":       data.imap_ssl,
        "mail_imap_enabled":   data.imap_enabled,
    }

    updated = []
    for key, value in mapping.items():
        # Leere Passwort-Felder (••••••••) ignorieren — kein Überschreiben
        if value is None or value == "••••••••":
            continue
        await set_config_value(db, key, value)
        updated.append(key)

    await db.commit()

    await log_action(
        db, user=current_user,
        action="mail_config_updated",
        resource_type="system",
        detail=f"Updated: {', '.join(updated)}",
        request=request,
    )

    return {"detail": "Mail-Konfiguration gespeichert.", "updated": updated}


# ─── POST /api/admin/mail-config/test-smtp ────────────────────────────────────
@router.post("/mail-config/test-smtp")
async def test_smtp(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Sendet eine Test-Mail über die aktuelle SMTP-Konfiguration."""
    from app.mail.client import send_email
    try:
        await send_email(
            to_email=current_user.email,
            subject="ZE-Ticket — SMTP Verbindungstest",
            html_body=f"""
                <h3>SMTP-Test erfolgreich</h3>
                <p>Diese Mail wurde automatisch von ZE-Ticket gesendet,
                um die SMTP-Konfiguration zu bestätigen.</p>
                <p>Empfänger: <strong>{current_user.email}</strong></p>
            """,
            plain_body="SMTP-Test erfolgreich. ZE-Ticket Mailversand funktioniert.",
        )
        return {"status": "ok", "detail": f"Test-Mail an {current_user.email} gesendet."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP-Fehler: {str(e)}")


# ─── POST /api/admin/mail-config/test-imap ────────────────────────────────────
@router.post("/mail-config/test-imap")
async def test_imap(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Testet die IMAP-Verbindung mit der aktuellen Konfiguration."""
    import ssl as ssl_module
    import aioimaplib
    from app.mail.config import get_imap_config

    cfg = await get_imap_config()

    if not cfg.host or not cfg.user or not cfg.password:
        raise HTTPException(status_code=400, detail="IMAP-Konfiguration unvollständig.")

    ssl_ctx = ssl_module.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl_module.CERT_NONE

    try:
        imap = aioimaplib.IMAP4_SSL(
            host=cfg.host,
            port=cfg.port,
            ssl_context=ssl_ctx,
        )
        await imap.wait_hello_from_server()
        await imap.login(cfg.user, cfg.password)
        await imap.select("INBOX")
        _, data = await imap.search("UNSEEN")
        unseen = len(data[0].decode().split()) if data[0] and data[0].decode() else 0
        await imap.logout()
        return {"status": "ok", "detail": f"IMAP-Verbindung erfolgreich. {unseen} ungelesene Mail(s)."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"IMAP-Fehler: {str(e)}")

# ─── GET /api/admin/templates ─────────────────────────────────────────────────
@router.get("/templates")
async def get_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Alle E-Mail-Templates abrufen."""
    from app.api.config import get_template, TEMPLATE_DEFAULTS
    result = {}
    for key in TEMPLATE_DEFAULTS:
        result[key] = await get_template(db, key)
    return result


# ─── PATCH /api/admin/templates/{key} ─────────────────────────────────────────
class TemplateUpdate(BaseModel):
    value: str

@router.patch("/templates/{key}")
async def update_template(
    key: str,
    data: TemplateUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """E-Mail-Template aktualisieren."""
    from app.api.config import set_config_value, TEMPLATE_DEFAULTS
    if key not in TEMPLATE_DEFAULTS:
        raise HTTPException(status_code=404, detail="Template nicht gefunden.")
    await set_config_value(db, key, data.value)
    await db.commit()
    await log_action(
        db, user=current_user,
        action="template_updated",
        resource_type="system",
        detail=f"Template: {key}",
        request=request,
    )
    return {"detail": "Template gespeichert.", "key": key}


# ─── POST /api/admin/templates/{key}/reset ────────────────────────────────────
@router.post("/templates/{key}/reset")
async def reset_template(
    key: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Template auf Standard zurücksetzen."""
    from app.api.config import TEMPLATE_DEFAULTS
    from app.models.config import SystemConfig
    from sqlalchemy import select
    if key not in TEMPLATE_DEFAULTS:
        raise HTTPException(status_code=404, detail="Template nicht gefunden.")
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    cfg = result.scalar_one_or_none()
    if cfg:
        await db.delete(cfg)
        await db.commit()
    await log_action(
        db, user=current_user,
        action="template_reset",
        resource_type="system",
        detail=f"Template: {key}",
        request=request,
    )
    return {"detail": "Template auf Standard zurückgesetzt.", "key": key}

# ─── GET /api/admin/charts ────────────────────────────────────────────────────
@router.get("/charts")
async def get_chart_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Alle Chart-Daten für Admin-Statistiken."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, cast, Date
    from app.models.ticket import Ticket, TicketStatus, TicketPriority, Comment
    from app.models.group import Group

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago  = now - timedelta(days=7)

    # ── Tickets pro Tag (letzte 30 Tage) ──
    tickets_per_day_raw = await db.execute(
        select(
            cast(Ticket.created_at, Date).label("day"),
            func.count(Ticket.id).label("count")
        )
        .where(Ticket.created_at >= thirty_days_ago)
        .group_by(cast(Ticket.created_at, Date))
        .order_by(cast(Ticket.created_at, Date))
    )
    tickets_per_day = [
        {"date": str(row.day), "tickets": row.count}
        for row in tickets_per_day_raw
    ]

    # ── Tickets nach Status ──
    status_raw = await db.execute(
        select(Ticket.status, func.count(Ticket.id).label("count"))
        .group_by(Ticket.status)
    )
    tickets_by_status = [
        {"status": row.status.value, "count": row.count}
        for row in status_raw
    ]

    # ── Tickets nach Priorität ──
    prio_raw = await db.execute(
        select(Ticket.priority, func.count(Ticket.id).label("count"))
        .group_by(Ticket.priority)
    )
    tickets_by_priority = [
        {"priority": row.priority.value, "count": row.count}
        for row in prio_raw
    ]

    # ── Durchschnittliche Lösungszeit (gelöste Tickets) ──
    resolved = await db.execute(
        select(Ticket.created_at, Ticket.updated_at)
        .where(Ticket.status.in_([TicketStatus.GELOEST, TicketStatus.GESCHLOSSEN]))
    )
    resolved_rows = resolved.fetchall()
    if resolved_rows:
        durations = [(r.updated_at - r.created_at).total_seconds() / 3600 for r in resolved_rows]
        avg_hours = round(sum(durations) / len(durations), 1)
    else:
        avg_hours = 0

    # ── Tickets pro Agent (Top 10) ──
    agent_raw = await db.execute(
        select(User.display_name, func.count(Ticket.id).label("count"))
        .join(Ticket, Ticket.assigned_agent_id == User.id)
        .group_by(User.display_name)
        .order_by(func.count(Ticket.id).desc())
        .limit(10)
    )
    tickets_by_agent = [
        {"agent": row.display_name, "count": row.count}
        for row in agent_raw
    ]

    # ── Tickets pro Gruppe ──
    group_raw = await db.execute(
        select(Group.name, func.count(Ticket.id).label("count"))
        .join(Ticket, Ticket.assigned_group_id == Group.id)
        .group_by(Group.name)
        .order_by(func.count(Ticket.id).desc())
    )
    tickets_by_group = [
        {"group": row.name, "count": row.count}
        for row in group_raw
    ]

    # ── SLA-Einhaltungsrate ──
    total_sla = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.sla_id.isnot(None))
    )
    total_sla_count = total_sla.scalar() or 0

    breached_sla = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.sla_breached == True)
    )
    breached_count = breached_sla.scalar() or 0

    sla_rate = round((1 - breached_count / total_sla_count) * 100, 1) if total_sla_count > 0 else 100.0

    # ── SLA-Verletzungen pro Tag (letzte 7 Tage) ──
    sla_breach_raw = await db.execute(
        select(
            cast(Ticket.updated_at, Date).label("day"),
            func.count(Ticket.id).label("count")
        )
        .where(Ticket.sla_breached == True)
        .where(Ticket.updated_at >= seven_days_ago)
        .group_by(cast(Ticket.updated_at, Date))
        .order_by(cast(Ticket.updated_at, Date))
    )
    sla_breaches_per_day = [
        {"date": str(row.day), "violations": row.count}
        for row in sla_breach_raw
    ]

    # ── Speicherverbrauch Uploads ──
    import os
    uploads_dir = "/app/uploads"
    total_bytes = 0
    if os.path.exists(uploads_dir):
        for dirpath, _, filenames in os.walk(uploads_dir):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total_bytes += os.path.getsize(fp)
                except OSError:
                    pass
    upload_mb = round(total_bytes / (1024 * 1024), 2)

    return {
        "tickets_per_day":      tickets_per_day,
        "tickets_by_status":    tickets_by_status,
        "tickets_by_priority":  tickets_by_priority,
        "avg_resolution_hours": avg_hours,
        "tickets_by_agent":     tickets_by_agent,
        "tickets_by_group":     tickets_by_group,
        "sla_rate":             sla_rate,
        "sla_breaches_per_day": sla_breaches_per_day,
        "upload_mb":            upload_mb,
    }

# ─── GET /api/admin/backup-config ─────────────────────────────────────────────
@router.get("/backup-config")
async def get_backup_config_api(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Backup-Konfiguration abrufen — Passwörter maskiert."""
    from app.api.config import get_config_value

    async def val(key): return await get_config_value(db, key)

    return {
        "general": {
            "enabled":         await val("backup_enabled"),
            "target":          await val("backup_target"),
            "schedule_hour":   await val("backup_schedule_hour"),
            "retention_days":  await val("backup_retention_days"),
            "retention_min":   await val("backup_retention_min"),
            "include_uploads": await val("backup_include_uploads"),
        },
        "local": {
            "path": await val("backup_local_path"),
        },
        "webdav": {
            "url":      await val("backup_webdav_url"),
            "user":     await val("backup_webdav_user"),
            "password": "••••••••" if await val("backup_webdav_password") else "",
            "path":     await val("backup_webdav_path"),
        },
        "sftp": {
            "host":     await val("backup_sftp_host"),
            "port":     await val("backup_sftp_port"),
            "user":     await val("backup_sftp_user"),
            "password": "••••••••" if await val("backup_sftp_password") else "",
            "path":     await val("backup_sftp_path"),
        },
        "s3": {
            "endpoint":   await val("backup_s3_endpoint"),
            "bucket":     await val("backup_s3_bucket"),
            "region":     await val("backup_s3_region"),
            "access_key": await val("backup_s3_access_key"),
            "secret_key": "••••••••" if await val("backup_s3_secret_key") else "",
            "path":       await val("backup_s3_path"),
        },
    }


# ─── PATCH /api/admin/backup-config ───────────────────────────────────────────
class BackupConfigUpdate(BaseModel):
    enabled:         Optional[str] = None
    target:          Optional[str] = None
    schedule_hour:   Optional[str] = None
    retention_days:  Optional[str] = None
    retention_min:   Optional[str] = None
    include_uploads: Optional[str] = None
    local_path:      Optional[str] = None
    webdav_url:      Optional[str] = None
    webdav_user:     Optional[str] = None
    webdav_password: Optional[str] = None
    webdav_path:     Optional[str] = None
    sftp_host:       Optional[str] = None
    sftp_port:       Optional[str] = None
    sftp_user:       Optional[str] = None
    sftp_password:   Optional[str] = None
    sftp_path:       Optional[str] = None
    s3_endpoint:     Optional[str] = None
    s3_bucket:       Optional[str] = None
    s3_region:       Optional[str] = None
    s3_access_key:   Optional[str] = None
    s3_secret_key:   Optional[str] = None
    s3_path:         Optional[str] = None

@router.patch("/backup-config")
async def update_backup_config(
    data: BackupConfigUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Backup-Konfiguration speichern."""
    from app.api.config import set_config_value
    mapping = {
        "backup_enabled":         data.enabled,
        "backup_target":          data.target,
        "backup_schedule_hour":   data.schedule_hour,
        "backup_retention_days":  data.retention_days,
        "backup_retention_min":   data.retention_min,
        "backup_include_uploads": data.include_uploads,
        "backup_local_path":      data.local_path,
        "backup_webdav_url":      data.webdav_url,
        "backup_webdav_user":     data.webdav_user,
        "backup_webdav_password": data.webdav_password,
        "backup_webdav_path":     data.webdav_path,
        "backup_sftp_host":       data.sftp_host,
        "backup_sftp_port":       data.sftp_port,
        "backup_sftp_user":       data.sftp_user,
        "backup_sftp_password":   data.sftp_password,
        "backup_sftp_path":       data.sftp_path,
        "backup_s3_endpoint":     data.s3_endpoint,
        "backup_s3_bucket":       data.s3_bucket,
        "backup_s3_region":       data.s3_region,
        "backup_s3_access_key":   data.s3_access_key,
        "backup_s3_secret_key":   data.s3_secret_key,
        "backup_s3_path":         data.s3_path,
    }
    updated = []
    for key, value in mapping.items():
        if value is None or value == "••••••••":
            continue
        await set_config_value(db, key, value)
        updated.append(key)
    await db.commit()
    await log_action(
        db, user=current_user,
        action="backup_config_updated",
        resource_type="system",
        detail=f"Updated: {', '.join(updated)}",
        request=request,
    )
    return {"detail": "Backup-Konfiguration gespeichert.", "updated": updated}


# ─── POST /api/admin/backup/run ───────────────────────────────────────────────
@router.post("/backup/run")
async def run_backup_now(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Backup sofort ausführen."""
    from app.backup.engine import run_backup
    result = await run_backup()
    await log_action(
        db, user=current_user,
        action="backup_manual",
        resource_type="system",
        detail=str(result),
        request=request,
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error", "Backup fehlgeschlagen."))
    return result


# ─── POST /api/admin/backup/test ──────────────────────────────────────────────
@router.post("/backup/test")
async def test_backup_target(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Testet die Verbindung zum konfigurierten Backup-Ziel."""
    from app.backup.engine import get_backup_config
    import tempfile, os

    cfg = await get_backup_config()
    target = cfg.get("backup_target", "local")
    test_data = b"ZE-Ticket Backup Connection Test"
    test_file = f"ze-ticket-test_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.txt"

    try:
        if target == "local":
            from app.backup.engine import upload_local
            await upload_local(test_data, test_file, cfg)
            # Testdatei wieder löschen
            path = Path(cfg.get("backup_local_path") or "/app/backups") / test_file
            if path.exists(): path.unlink()

        elif target == "webdav":
            from app.backup.engine import upload_webdav
            await upload_webdav(test_data, test_file, cfg)

        elif target == "sftp":
            from app.backup.engine import upload_sftp
            await upload_sftp(test_data, test_file, cfg)

        elif target == "s3":
            from app.backup.engine import upload_s3
            await upload_s3(test_data, test_file, cfg)

        return {"status": "ok", "detail": f"Verbindung zu '{target}' erfolgreich."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verbindungstest fehlgeschlagen: {str(e)}")

# ─── POST /api/admin/backup/restore ───────────────────────────────────────────
@router.post("/backup/restore")
async def restore_backup(
    request: Request,
    file: UploadFile = File(...),
    restore_db: str = "true",
    restore_uploads: str = "true",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Backup wiederherstellen — aus hochgeladenem .tar.gz Archiv."""
    from app.backup.restore import restore_from_archive

    # Nur Superadmins dürfen restoren
    if current_user.role.value not in ("superadmin",):
        raise HTTPException(status_code=403, detail="Nur Superadmins können Backups einspielen.")

    # Dateiprüfung
    if not file.filename.endswith(".tar.gz"):
        raise HTTPException(status_code=400, detail="Nur .tar.gz Dateien erlaubt.")

    # Max 500MB
    contents = await file.read()
    if len(contents) > 500 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Datei zu groß. Maximum: 500MB.")

    result = await restore_from_archive(
        archive_data=contents,
        restore_db=restore_db.lower() == "true",
        restore_uploads=restore_uploads.lower() == "true",
    )

    await log_action(
        db, user=current_user,
        action="backup_restored",
        resource_type="system",
        detail=f"Restore: {file.filename} — Status: {result.get('status')}",
        request=request,
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error"))

    return result
