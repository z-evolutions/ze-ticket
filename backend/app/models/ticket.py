import uuid
from sqlalchemy import Column, String, Text, Enum, ForeignKey, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base, TimestampMixin


# ─── Enums ─────────────────────────────────────────────────────────────────────

class TicketStatus(str, enum.Enum):
    NEU = "neu"
    IN_BEARBEITUNG = "in_bearbeitung"
    GELOEST = "geloest"
    GESCHLOSSEN = "geschlossen"


class TicketPriority(str, enum.Enum):
    NIEDRIG = "niedrig"
    NORMAL = "normal"
    HOCH = "hoch"
    KRITISCH = "kritisch"


class TicketChannel(str, enum.Enum):
    WEB = "web"
    EMAIL = "email"


class CommentType(str, enum.Enum):
    ANTWORT = "antwort"          # Sichtbar für Kunden
    INTERNE_NOTIZ = "interne_notiz"  # Nur für Agenten


# ─── Ticket ────────────────────────────────────────────────────────────────────

class Ticket(Base, TimestampMixin):
    __tablename__ = "tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Menschenlesbares Format: ZE-2026-0001
    ticket_number = Column(String(20), unique=True, nullable=False, index=True)
    year = Column(Integer, nullable=False)
    sequence = Column(Integer, nullable=False)

    # Inhalt
    subject = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    tags = Column(ARRAY(String), default=list)

    # Status & Priorität
    status = Column(Enum(TicketStatus), default=TicketStatus.NEU, nullable=False)
    priority = Column(Enum(TicketPriority), default=TicketPriority.NORMAL, nullable=False)
    channel = Column(Enum(TicketChannel), default=TicketChannel.WEB, nullable=False)

    # Zuweisung
    assigned_agent_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # SLA
    sla_id = Column(UUID(as_uuid=True), ForeignKey("slas.id", ondelete="SET NULL"), nullable=True)
    sla_due_at = Column(DateTime(timezone=True), nullable=True)
    sla_breached = Column(Boolean, default=False)

    # E-Mail (für eingehende Mails)
    email_message_id = Column(String(500), nullable=True)   # Für E-Mail-Threading

    # Beziehungen
    assigned_agent = relationship("User", back_populates="assigned_tickets", foreign_keys=[assigned_agent_id])
    assigned_group = relationship("Group", back_populates="tickets")
    created_by = relationship("User", back_populates="created_tickets", foreign_keys=[created_by_id])
    sla = relationship("SLA", back_populates="tickets")
    comments = relationship("Comment", back_populates="ticket", cascade="all, delete-orphan", order_by="Comment.created_at")
    attachments = relationship("Attachment", back_populates="ticket", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Ticket {self.ticket_number}: {self.subject[:40]}>"


# ─── Comment ───────────────────────────────────────────────────────────────────

class Comment(Base, TimestampMixin):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    content = Column(Text, nullable=False)
    comment_type = Column(Enum(CommentType), default=CommentType.ANTWORT, nullable=False)

    # Beziehungen
    ticket = relationship("Ticket", back_populates="comments")
    author = relationship("User")
    attachments = relationship("Attachment", back_populates="comment", cascade="all, delete-orphan")


# ─── Attachment ────────────────────────────────────────────────────────────────

class Attachment(Base, TimestampMixin):
    __tablename__ = "attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    filename = Column(String(500), nullable=False)
    stored_filename = Column(String(500), nullable=False)   # UUID-basierter Dateiname auf Disk
    mimetype = Column(String(100), nullable=False)
    filesize = Column(Integer, nullable=False)              # Bytes

    # Beziehungen
    ticket = relationship("Ticket", back_populates="attachments")
    comment = relationship("Comment", back_populates="attachments")
