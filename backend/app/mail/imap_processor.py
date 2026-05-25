"""
IMAP-Processor: Verarbeitet eingehende E-Mails.

Logik:
1. Ist es eine Antwort auf ein bestehendes Ticket? → Kommentar hinzufügen
2. Sonst → Neues Ticket + ggf. Kunden-Account anlegen
"""
import logging
from app.websocket.manager import broadcast_stats_update
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ticket import Ticket, Comment, CommentType, TicketChannel
from app.models.user import User, UserRole
from app.mail.imap_client import ParsedMail
from app.mail.smtp_ticket import send_ticket_confirmation
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

TICKET_NUMBER_RE = re.compile(r'\[ZE-(\d{4})-(\d+)\]')


def extract_ticket_number(subject: str) -> str | None:
    match = TICKET_NUMBER_RE.search(subject)
    if match:
        year, seq = match.group(1), match.group(2)
        return f"ZE-{year}-{int(seq):04d}"
    return None


async def _next_sequence(db: AsyncSession) -> tuple[str, int, int]:
    import datetime
    from sqlalchemy import func
    year = datetime.datetime.now().year
    result = await db.execute(
        select(func.max(Ticket.sequence)).where(Ticket.year == year)
    )
    last = result.scalar() or 0
    seq = last + 1
    return f"ZE-{year}-{seq:04d}", year, seq


async def _get_or_create_customer(db: AsyncSession, email: str, name: str) -> User:
    """
    Sucht einen User mit dieser E-Mail.
    Falls nicht vorhanden → legt automatisch einen Kunden-Account an.
    Kein Passwort nötig — Login über E-Mail + Ticket-Nummer.
    """
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()

    if user:
        return user

    # Anzeigename aus E-Mail-Name ableiten
    display_name = name if name and name != email else email.split('@')[0].replace('.', ' ').title()

    user = User(
        email=email.lower(),
        display_name=display_name,
        hashed_password="",        # Kein Passwort — Login über Ticket-Nummer
        role=UserRole.KUNDE,
        is_active=True,
        is_onboarding=False,       # Kein Onboarding für automatisch angelegte Kunden
    )
    db.add(user)
    await db.flush()
    logger.info(f"[PROCESSOR] Neuer Kunden-Account angelegt: {email}")
    return user


async def process_mail(mail: ParsedMail) -> None:
    async with AsyncSessionLocal() as db:
        try:
            await _process(db, mail)
            await db.commit()
            await broadcast_stats_update()
        except Exception as e:
            await db.rollback()
            logger.error(f"[PROCESSOR] Fehler bei {mail.from_email}: {e}")


async def _process(db: AsyncSession, mail: ParsedMail) -> None:

    # ── Schritt 1: Antwort auf bestehendes Ticket? ────────────────────────────

    ticket = None

    ticket_number = extract_ticket_number(mail.subject)
    if ticket_number:
        result = await db.execute(
            select(Ticket).where(Ticket.ticket_number == ticket_number)
        )
        ticket = result.scalar_one_or_none()

    if not ticket and (mail.in_reply_to or mail.references):
        ref_ids = []
        if mail.in_reply_to:
            ref_ids.append(mail.in_reply_to)
        if mail.references:
            ref_ids.extend(mail.references.split())
        for ref_id in ref_ids:
            result = await db.execute(
                select(Ticket).where(Ticket.email_message_id == ref_id)
            )
            ticket = result.scalar_one_or_none()
            if ticket:
                break

    # ── Schritt 2: Absender ermitteln / anlegen ───────────────────────────────

    sender = await _get_or_create_customer(db, mail.from_email, mail.from_name)

    # ── Schritt 3a: Antwort → Kommentar ──────────────────────────────────────

    if ticket:
        logger.info(f"[PROCESSOR] Antwort auf {ticket.ticket_number} von {mail.from_email}")

        comment = Comment(
            ticket_id=ticket.id,
            author_id=sender.id,
            content=mail.body,
            comment_type=CommentType.ANTWORT,
        )
        db.add(comment)

        if ticket.status == "geschlossen":
            ticket.status = "neu"

        return

    # ── Schritt 3b: Neues Ticket anlegen ─────────────────────────────────────

    logger.info(f"[PROCESSOR] Neues Ticket von {mail.from_email}: {mail.subject}")

    ticket_number, year, seq = await _next_sequence(db)

    clean_subject = re.sub(r'^(Re|Fwd|AW|WG):\s*', '', mail.subject, flags=re.IGNORECASE).strip()
    if not clean_subject:
        clean_subject = mail.subject

    ticket = Ticket(
        ticket_number=ticket_number,
        year=year,
        sequence=seq,
        subject=clean_subject,
        description=mail.body,
        channel=TicketChannel.EMAIL,
        created_by_id=sender.id,
        email_message_id=mail.message_id or None,
    )
    db.add(ticket)
    await db.flush()

    logger.info(f"[PROCESSOR] Ticket {ticket_number} für Kunde {mail.from_email} angelegt.")

    try:
        await send_ticket_confirmation(
            to_email=mail.from_email,
            to_name=mail.from_name or mail.from_email,
            ticket_number=ticket_number,
            ticket_subject=clean_subject,
        )
    except Exception as e:
        logger.error(f"[PROCESSOR] Bestätigungsmail fehlgeschlagen: {e}")
