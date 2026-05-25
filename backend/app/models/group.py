import uuid
from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin
from app.models.user import user_group_association


class Group(Base, TimestampMixin):
    __tablename__ = "groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(500), nullable=True)

    # Gruppenspezifische E-Mail für Ticketverkehr
    email = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    # Beziehungen
    members = relationship("User", secondary=user_group_association, back_populates="groups")
    tickets = relationship("Ticket", back_populates="assigned_group")

    def __repr__(self):
        return f"<Group {self.name}>"
