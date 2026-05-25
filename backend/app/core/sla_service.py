"""
SLA-Service — automatische Zuweisung und Überwachung.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.sla import SLA, SLAPriorityScope
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User, UserRole
from app.mail.smtp_ticket import send_sla_breach_mail

logger = logging.getLogger(__name__)


async def assign_sla(db: AsyncSession, ticket: Ticket) -> None:
    """
    Weist dem Ticket automatisch eine SLA zu basierend auf der Priorität.
    Sucht zuerst nach einer prioritätsspezifischen Regel, dann nach 'alle'.
    """
    try:
        # Priorität als SLAPriorityScope-Enum konvertieren
        priority_raw = ticket.priority.value if hasattr(ticket.priority, 'value') else str(ticket.priority)
        try:
            priority_scope_val = SLAPriorityScope(priority_raw.lower())
        except ValueError:
            priority_scope_val = None

        sla = None

        # Erst spezifische Regel suchen
        if priority_scope_val:
            result = await db.execute(
                select(SLA).where(
                    SLA.is_active == True,
                    SLA.priority_scope == priority_scope_val,
                ).limit(1)
            )
            sla = result.scalar_one_or_none()

        # Fallback: Regel für "alle"
        if not sla:
            result = await db.execute(
                select(SLA).where(
                    SLA.is_active == True,
                    SLA.priority_scope == SLAPriorityScope.ALLE,
                ).limit(1)
            )
            sla = result.scalar_one_or_none()

        if sla:
            ticket.sla_id = sla.id
            ticket.sla_due_at = datetime.now(timezone.utc) + timedelta(minutes=sla.resolution_time_minutes)
            logger.info(f"SLA '{sla.name}' → Ticket {ticket.ticket_number} (fällig: {ticket.sla_due_at})")
        else:
            logger.info(f"Keine passende SLA für Ticket {ticket.ticket_number} (Priorität: {priority_raw})")

    except Exception as e:
        logger.error(f"Fehler bei SLA-Zuweisung: {e}", exc_info=True)


async def cleanup_audit_log() -> None:
    """
    Background-Task — löscht Audit-Log-Einträge älter als 90 Tage.
    Läuft einmal täglich.
    """
    from app.models.audit import AuditLog
    from sqlalchemy import delete

    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    while True:
        try:
            async with async_session() as db:
                cutoff = datetime.now(timezone.utc) - timedelta(days=90)
                result = await db.execute(
                    delete(AuditLog).where(AuditLog.created_at < cutoff)
                )
                await db.commit()
                deleted = result.rowcount
                if deleted > 0:
                    logger.info(f"Audit-Log Cleanup: {deleted} Einträge älter als 90 Tage gelöscht.")
        except Exception as e:
            logger.error(f"Audit-Log Cleanup Fehler: {e}", exc_info=True)

        await asyncio.sleep(86400)  # 24 Stunden


async def check_sla_breaches() -> None:
    """
    Background-Task — prüft alle 5 Minuten ob SLA-Fristen abgelaufen sind.
    Setzt sla_breached=True und sendet Eskalations-Mail.
    """
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    while True:
        try:
            async with async_session() as db:
                now = datetime.now(timezone.utc)

                result = await db.execute(
                    select(Ticket).where(
                        Ticket.sla_due_at <= now,
                        Ticket.sla_breached == False,
                        Ticket.status.notin_([TicketStatus.GELOEST, TicketStatus.GESCHLOSSEN]),
                    )
                )
                tickets = result.scalars().all()

                for ticket in tickets:
                    ticket.sla_breached = True
                    logger.warning(f"SLA verletzt: {ticket.ticket_number}")

                    try:
                        recipient_id = ticket.assigned_agent_id
                        if not recipient_id:
                            mgr = await db.execute(
                                select(User).where(
                                    User.role.in_([UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERADMIN]),
                                    User.is_active == True,
                                ).limit(1)
                            )
                            mgr_user = mgr.scalar_one_or_none()
                            if mgr_user:
                                recipient_id = mgr_user.id

                        if recipient_id:
                            recipient = await db.get(User, recipient_id)
                            if recipient:
                                await send_sla_breach_mail(
                                    to_email=recipient.email,
                                    display_name=recipient.display_name,
                                    ticket_number=ticket.ticket_number,
                                    ticket_subject=ticket.subject,
                                    due_at=ticket.sla_due_at,
                                )
                    except Exception as mail_err:
                        logger.error(f"SLA-Eskalationsmail Fehler: {mail_err}")

                if tickets:
                    await db.commit()
                    logger.info(f"SLA-Check: {len(tickets)} Ticket(s) als verletzt markiert.")

        except Exception as e:
            logger.error(f"SLA-Check Fehler: {e}", exc_info=True)

        await asyncio.sleep(300)
