import uuid
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base, TimestampMixin


# ─── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    MANAGER = "manager"
    AGENT = "agent"
    KUNDE = "kunde"


class UITheme(str, enum.Enum):
    DARK = "dark"
    LIGHT = "light"


class UILanguage(str, enum.Enum):
    DE = "de"
    EN = "en"


# ─── Zwischentabelle: User <-> Group (Many-to-Many) ────────────────────────────

user_group_association = Table(
    "user_groups",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")),
    Column("group_id", UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE")),
)


# ─── User ──────────────────────────────────────────────────────────────────────

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Login-Daten (intern, nie nach außen)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Öffentliches Profil
    display_name = Column(String(100), nullable=False)        # Anzeigename (Pseudonym)
    full_name = Column(String(255), nullable=True)            # Echter Name (nur intern sichtbar)
    avatar_url = Column(String(500), nullable=True)           # Hochgeladener Avatar
    gravatar_email = Column(String(255), nullable=True)       # Optionale Gravatar-E-Mail
    avatar_public = Column(Boolean, default=False)            # Sichtbar für Kunden?

    # Rolle & Berechtigungen
    role = Column(Enum(UserRole), nullable=False, default=UserRole.KUNDE)

    # Einstellungen
    theme = Column(Enum(UITheme), default=UITheme.DARK)
    language = Column(Enum(UILanguage), default=UILanguage.DE)

    # Account-Status
    is_active = Column(Boolean, default=True)
    is_onboarding = Column(Boolean, default=True)   # True = muss Passwort ändern
    onboarding_token = Column(String(255), nullable=True)  # Einmalpasswort-Token

    # Beziehungen
    groups = relationship("Group", secondary=user_group_association, back_populates="members")
    assigned_tickets = relationship("Ticket", back_populates="assigned_agent", foreign_keys="Ticket.assigned_agent_id")
    created_tickets = relationship("Ticket", back_populates="created_by", foreign_keys="Ticket.created_by_id")

    def __repr__(self):
        return f"<User {self.display_name} ({self.role})>"
