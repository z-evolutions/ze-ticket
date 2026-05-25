from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

from app.models.ticket import TicketStatus, TicketPriority, TicketChannel, CommentType


# ─── Agent-Kurzinfo ────────────────────────────────────────────────────────────

class AgentShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    avatar_url: Optional[str] = None


# ─── Kommentar-Ausgabe ─────────────────────────────────────────────────────────

class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    content: str
    comment_type: CommentType
    created_at: datetime
    author: Optional[AgentShort] = None


# ─── Ticket erstellen ──────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    subject: str
    description: str
    priority: TicketPriority = TicketPriority.NORMAL
    tags: list[str] = []
    assigned_agent_id: Optional[UUID] = None
    assigned_group_id: Optional[UUID] = None


# ─── Ticket aktualisieren ─────────────────────────────────────────────────────

class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    tags: Optional[list[str]] = None
    assigned_agent_id: Optional[UUID] = None
    assigned_group_id: Optional[UUID] = None


# ─── Ticket-Ausgabe (Liste) ────────────────────────────────────────────────────

class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    subject: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    channel: TicketChannel
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    sla_due_at: Optional[datetime] = None
    sla_breached: bool

    assigned_agent: Optional[AgentShort] = None
    assigned_group_id: Optional[UUID] = None
    created_by_id: Optional[UUID] = None


# ─── Ticket-Ausgabe (Detail, mit Kommentaren) ─────────────────────────────────

class TicketDetailResponse(TicketResponse):
    comments: list[CommentResponse] = []


# ─── Ticket-Liste ──────────────────────────────────────────────────────────────

class TicketListResponse(BaseModel):
    tickets: list[TicketResponse]
    total: int
    page: int
    page_size: int


# ─── Dashboard-Statistiken ────────────────────────────────────────────────────

class TicketStats(BaseModel):
    total: int
    neu: int
    in_bearbeitung: int
    geloest: int
    geschlossen: int
    meine_tickets: int
    sla_breached: int


# ─── Kommentar erstellen ───────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str
    comment_type: CommentType = CommentType.ANTWORT
