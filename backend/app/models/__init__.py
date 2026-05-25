# Alle Modelle hier importieren — Alembic findet sie dadurch automatisch
from app.models.base import Base, TimestampMixin
from app.models.user import User, UserRole, UITheme, UILanguage, user_group_association
from app.models.group import Group
from app.models.sla import SLA, SLAPriorityScope
from app.models.ticket import Ticket, Comment, Attachment, TicketStatus, TicketPriority, TicketChannel, CommentType
from app.models.audit import AuditLog
from app.models.config import SystemConfig

__all__ = [
    "Base",
    "TimestampMixin",
    "User",
    "UserRole",
    "UITheme",
    "UILanguage",
    "user_group_association",
    "Group",
    "SLA",
    "SLAPriorityScope",
    "Ticket",
    "Comment",
    "Attachment",
    "TicketStatus",
    "TicketPriority",
    "TicketChannel",
    "CommentType",
    "AuditLog",
    "SystemConfig",
]
