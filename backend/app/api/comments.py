from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
import logging

from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.ticket import Ticket, Comment, CommentType
from app.schemas.ticket import CommentCreate, CommentResponse
from app.mail.smtp_ticket import send_comment_notification
from app.websocket.manager import broadcast_new_comment, broadcast_stats_update

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tickets", tags=["Kommentare"])


@router.post("/{ticket_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment(
    ticket_id: UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ticket laden (mit created_by für Mail-Versand)
    result = await db.execute(
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(selectinload(Ticket.created_by))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden.")

    # Kunden dürfen nur Antworten schreiben, keine internen Notizen
    if current_user.role == UserRole.KUNDE:
        if ticket.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Kein Zugriff auf dieses Ticket.")
        if data.comment_type == CommentType.INTERNE_NOTIZ:
            raise HTTPException(status_code=403, detail="Kunden können keine internen Notizen schreiben.")

    comment = Comment(
        ticket_id=ticket_id,
        author_id=current_user.id,
        content=data.content.strip(),
        comment_type=data.comment_type,
    )
    db.add(comment)
    await db.commit()

    # Mit Author-Relation zurückgeben
    await db.refresh(comment)
    result = await db.execute(
        select(Comment)
        .where(Comment.id == comment.id)
        .options(selectinload(Comment.author))
    )
    comment = result.scalar_one()

    # WebSocket broadcast
    await broadcast_new_comment(str(ticket_id), ticket.ticket_number, data.comment_type.value, assigned_agent_id=str(ticket.assigned_agent_id) if ticket.assigned_agent_id else None, author_id=str(current_user.id))

    # ── Antwortmail an Ticket-Ersteller ───────────────────────────────────────
    # Nur bei Antworten (nicht bei internen Notizen) und nur wenn:
    # - Ticket wurde von jemandem erstellt
    # - Ersteller ist nicht der Kommentator selbst
    # - Ticket hat eine bekannte E-Mail-Adresse (created_by oder email_message_id)
    if data.comment_type == CommentType.ANTWORT:
        await _send_reply_notification(ticket, comment, current_user)

    return comment


async def _send_reply_notification(ticket: Ticket, comment: Comment, agent: User) -> None:
    """Benachrichtigungsmail an Ticket-Ersteller oder ursprünglichen Mail-Absender."""

    # Empfänger bestimmen
    to_email = None
    to_name = "Kunde"

    if ticket.created_by and ticket.created_by.id != agent.id:
        # Ticket wurde von einem bekannten User erstellt
        to_email = ticket.created_by.email
        to_name = ticket.created_by.display_name

    elif ticket.channel == "email" and ticket.email_message_id:
        # Ticket kam per E-Mail — Absender aus DB nicht bekannt
        # Wir haben keine direkte Absender-E-Mail gespeichert
        # TODO: from_email im Ticket-Modell speichern (Phase 4)
        logger.info(f"[MAIL] Ticket {ticket.ticket_number}: E-Mail-Kanal aber kein User — kein Versand")
        return

    if not to_email:
        logger.info(f"[MAIL] Ticket {ticket.ticket_number}: Kein Empfänger ermittelbar — kein Versand")
        return

    try:
        await send_comment_notification(
            to_email=to_email,
            to_name=to_name,
            ticket_number=ticket.ticket_number,
            ticket_subject=ticket.subject,
            agent_name=agent.display_name,
            comment_body=comment.content,
        )
        logger.info(f"[MAIL] Antwortmail für {ticket.ticket_number} → {to_email}")
    except Exception as e:
        logger.error(f"[MAIL] Antwortmail fehlgeschlagen für {ticket.ticket_number}: {e}")
