"""
Zentraler Audit-Log — Helper-Funktion für alle API-Endpunkte.

Verwendung:
    await log_action(
        db=db,
        user=current_user,
        action="ticket.created",
        resource_type="ticket",
        resource_id=str(ticket.id),
        resource_label=ticket.ticket_number,
        detail="Ticket erstellt via Web",
        request=request,
    )
"""
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request
from app.models.audit import AuditLog
import logging

logger = logging.getLogger(__name__)


async def log_action(
    db: AsyncSession,
    action: str,
    user=None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    resource_label: str | None = None,
    detail: str | None = None,
    request: Request | None = None,
):
    """
    Audit-Eintrag schreiben. Fehler werden geloggt aber nie weitergeworfen
    — der Audit-Log darf keine Business-Logik unterbrechen.
    """
    try:
        ip = None
        if request:
            # CF-Ray als primäre Referenz (eindeutig, nicht personenbezogen)
            cf_ray = request.headers.get("cf-ray")
            cf_country = request.headers.get("cf-ipcountry")
            forwarded_for = request.headers.get("x-forwarded-for", "")
            forwarded_ips = [x.strip() for x in forwarded_for.split(",") if x.strip() and x.strip().lower() != "(null)"]
            client_ip = forwarded_ips[0] if forwarded_ips else (request.client.host if request.client else None)
            # Kombinierter Eintrag: CF-Ray + Land + IP
            parts = []
            if cf_ray:   parts.append(f"ray:{cf_ray}")
            if cf_country: parts.append(f"cc:{cf_country}")
            if client_ip: parts.append(client_ip)
            ip = " | ".join(parts) if parts else None

        entry = AuditLog(
            user_id=user.id if user else None,
            user_display_name=user.display_name if user else "System",
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            resource_label=resource_label,
            detail=detail,
            ip_address=ip,
        )
        db.add(entry)
        await db.commit()
    except Exception as e:
        logger.error(f"Audit-Log Fehler: {e}", exc_info=True)
