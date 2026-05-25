"""
Öffentliche Portal-API — kein Login erforderlich.
Ticket beantragen + Formular-Felder abrufen.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from typing import Optional
import datetime
import json
import os

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketChannel, TicketPriority
from app.auth.dependencies import get_current_user, get_current_customer
from app.auth.password import hash_password, generate_onboarding_password
from app.search.client import get_es_client
from app.core.sla_service import assign_sla
from app.search.tickets import index_ticket
from app.mail.smtp_ticket import send_portal_ticket_confirmation
from app.websocket.manager import broadcast_ticket_update, broadcast_stats_update

router = APIRouter(prefix="/api/portal", tags=["Portal"])

# Formular-Konfiguration als JSON-Datei
FORM_CONFIG_FILE = "/app/data/portal_form.json"

DEFAULT_FORM_CONFIG = {
    "fields": [
        {"key": "first_name",  "label_de": "Vorname",     "label_en": "First name",    "type": "text",     "required": True},
        {"key": "last_name",   "label_de": "Nachname",    "label_en": "Last name",     "type": "text",     "required": True},
        {"key": "email",       "label_de": "E-Mail",      "label_en": "Email",         "type": "email",    "required": True},
        {"key": "subject",     "label_de": "Betreff",     "label_en": "Subject",       "type": "text",     "required": True},
        {"key": "description", "label_de": "Ihr Anliegen","label_en": "Your request",  "type": "textarea", "required": True},
    ]
}


def _load_form_config() -> dict:
    try:
        os.makedirs(os.path.dirname(FORM_CONFIG_FILE), exist_ok=True)
    except PermissionError:
        pass
    if not os.path.exists(FORM_CONFIG_FILE):
        _save_form_config(DEFAULT_FORM_CONFIG)
        return DEFAULT_FORM_CONFIG
    with open(FORM_CONFIG_FILE) as f:
        return json.load(f)


def _save_form_config(config: dict):
    try:
        os.makedirs(os.path.dirname(FORM_CONFIG_FILE), exist_ok=True)
    except PermissionError:
        pass
    with open(FORM_CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


# ─── GET /api/portal/form-config ─────────────────────────────────────────────

@router.get("/form-config")
async def get_form_config():
    """Öffentlich — Formular-Felder für Ticket-Beantragen."""
    return _load_form_config()


# ─── POST /api/portal/form-config (Admin) ────────────────────────────────────

@router.post("/form-config")
async def update_form_config(
    config: dict,
    current_user: User = Depends(get_current_user),
):
    """Admin kann Formular-Felder konfigurieren."""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Keine Berechtigung.")
    _save_form_config(config)
    return config


# ─── POST /api/portal/request-ticket ─────────────────────────────────────────

class TicketRequestData(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    subject: str
    description: str
    extra_fields: Optional[dict] = {}


@router.post("/request-ticket", status_code=201)
async def request_ticket(
    data: TicketRequestData,
    db: AsyncSession = Depends(get_db),
):
    """
    Öffentlich — Ticket beantragen ohne Login.
    Legt Kunden-Account an falls nicht vorhanden.
    """
    # Kunden-Account anlegen oder finden
    result = await db.execute(
        select(User).where(User.email == data.email.lower())
    )
    user = result.scalar_one_or_none()

    portal_password = None
    if not user:
        display_name = f"{data.first_name} {data.last_name}".strip()
        portal_password = generate_onboarding_password()
        user = User(
            email=data.email.lower(),
            display_name=display_name,
            full_name=display_name,
            hashed_password=hash_password(portal_password),
            role=UserRole.KUNDE,
            is_active=True,
            is_onboarding=False,
        )
        db.add(user)
        await db.flush()
    else:
        # Bestehender User ohne Passwort → neues generieren
        if not user.hashed_password:
            portal_password = generate_onboarding_password()
            user.hashed_password = hash_password(portal_password)
        else:
            portal_password = None

    # Ticket-Nummer generieren
    year = datetime.datetime.now().year
    last_seq = await db.execute(
        select(func.max(Ticket.sequence)).where(Ticket.year == year)
    )
    seq = (last_seq.scalar() or 0) + 1
    ticket_number = f"ZE-{year}-{seq:04d}"

    # Beschreibung mit extra Feldern anreichern
    description = data.description
    if data.extra_fields:
        extra = "\n\n---\n" + "\n".join(f"{k}: {v}" for k, v in data.extra_fields.items())
        description += extra

    ticket = Ticket(
        ticket_number=ticket_number,
        year=year,
        sequence=seq,
        subject=data.subject,
        description=description,
        channel=TicketChannel.WEB,
        created_by_id=user.id,
        priority=TicketPriority.NORMAL,
    )
    db.add(ticket)
    await db.flush()

    # SLA automatisch zuweisen
    await assign_sla(db, ticket)
    await db.commit()
    await broadcast_ticket_update(str(ticket.id), ticket.ticket_number, "created")
    await broadcast_stats_update()

    # ES indexieren
    try:
        from sqlalchemy import select as sa_select
        from sqlalchemy.orm import selectinload as sa_selectinload
        stmt_es = sa_select(Ticket).where(Ticket.id == ticket.id).options(
            sa_selectinload(Ticket.assigned_agent),
            sa_selectinload(Ticket.created_by),
        )
        res_es = await db.execute(stmt_es)
        ticket_es = res_es.scalar_one()
        await index_ticket(get_es_client(), ticket_es)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"ES-Indexierung fehlgeschlagen: {e}", exc_info=True)

    # Bestätigungsmail
    try:
        await send_portal_ticket_confirmation(
            to_email=data.email,
            to_name=f"{data.first_name} {data.last_name}",
            ticket_number=ticket_number,
            ticket_subject=data.subject,
            portal_password=portal_password,
        )
    except Exception as e:
        pass  # Ticket trotzdem angelegt

    return {
        "ticket_number": ticket_number,
        "message": "Ihr Ticket wurde erfolgreich erstellt. Sie erhalten eine Bestätigungsmail."
    }


# ─── GET /api/portal/my-tickets ──────────────────────────────────────────────

@router.get("/my-tickets")
async def my_tickets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kunden sehen nur ihre eigenen Tickets."""
    result = await db.execute(
        select(Ticket)
        .where(Ticket.created_by_id == current_user.id)
        .order_by(Ticket.created_at.desc())
    )
    tickets = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "ticket_number": t.ticket_number,
            "subject": t.subject,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat(),
        }
        for t in tickets
    ]


# ─── POST /api/portal/change-password ────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    new_password_confirm: str


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kunden können ihr Portal-Passwort ändern."""
    from app.auth.password import verify_password, hash_password, validate_password_policy

    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Aktuelles Passwort falsch.")

    if data.new_password != data.new_password_confirm:
        raise HTTPException(status_code=400, detail="Neue Passwörter stimmen nicht überein.")

    valid, msg = validate_password_policy(data.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    user.hashed_password = hash_password(data.new_password)
    await db.commit()

    return {"message": "Passwort erfolgreich geändert."}


# ─── DELETE /api/portal/delete-account ───────────────────────────────────────

@router.post("/delete-account")
async def delete_customer_account(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_customer),
):
    """
    Kunden-Selbstlöschung — anonymisiert alle persönlichen Daten.
    Tickets bleiben erhalten, werden aber anonymisiert.
    """
    import secrets
    import os
    from app.core.audit import log_action

    user_id = str(current_user.id)
    display_name_snapshot = current_user.display_name

    # Avatar-Datei löschen
    if current_user.avatar_url:
        avatar_path = f"/app{current_user.avatar_url}"
        if os.path.exists(avatar_path):
            os.remove(avatar_path)

    # Anonymisierung
    current_user.email          = f"deleted-{user_id}@deleted.invalid"
    current_user.display_name   = "Gelöschter Nutzer"
    current_user.full_name      = None
    current_user.avatar_url     = None
    current_user.hashed_password = secrets.token_hex(32)  # Login unmöglich
    current_user.is_active      = False
    current_user.gravatar_email = None

    await db.commit()

    # Audit-Log
    await log_action(
        db=db,
        action="user.self_deleted",
        user=None,  # User bereits anonymisiert
        resource_type="user",
        resource_id=user_id,
        resource_label=display_name_snapshot,
        detail="Kunden-Account auf eigenen Wunsch anonymisiert (DSGVO Art. 17)",
        request=request,
    )

    return {"detail": "Ihr Konto wurde erfolgreich gelöscht."}
