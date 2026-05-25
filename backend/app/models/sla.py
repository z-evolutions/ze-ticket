import uuid
from sqlalchemy import Column, String, Integer, Boolean, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base, TimestampMixin


class SLAPriorityScope(str, enum.Enum):
    NIEDRIG = "niedrig"
    NORMAL = "normal"
    HOCH = "hoch"
    KRITISCH = "kritisch"
    ALLE = "alle"


class SLA(Base, TimestampMixin):
    __tablename__ = "slas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)

    # Fristen in Minuten (flexibler als Stunden)
    response_time_minutes = Column(Integer, nullable=False)    # Erste Antwort
    resolution_time_minutes = Column(Integer, nullable=False)  # Lösung

    # Für welche Priorität gilt diese SLA?
    priority_scope = Column(Enum(SLAPriorityScope), default=SLAPriorityScope.ALLE)

    # Optional: Nur für bestimmte Gruppe
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)

    # Sichtbarkeit auf Kundenportal
    is_public = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # Beziehungen
    group = relationship("Group")
    tickets = relationship("Ticket", back_populates="sla")

    def __repr__(self):
        return f"<SLA {self.name} ({self.response_time_minutes}min / {self.resolution_time_minutes}min)>"
