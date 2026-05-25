import uuid
from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    """
    Zentraler Audit-Log — protokolliert alle sicherheitsrelevanten Aktionen.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Wer hat die Aktion ausgeführt?
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_display_name = Column(String(100), nullable=True)   # Snapshot — bleibt auch wenn User gelöscht

    # Was wurde getan?
    action = Column(String(100), nullable=False)             # z.B. "user.created", "ticket.closed"
    resource_type = Column(String(50), nullable=True)        # z.B. "ticket", "user", "group"
    resource_id = Column(String(100), nullable=True)         # UUID des betroffenen Objekts
    resource_label = Column(String(200), nullable=True)      # z.B. "ZE-2026-0001", "Sascha M"

    # Details
    detail = Column(Text, nullable=True)                     # Freitext, z.B. "Status: Neu → In Bearbeitung"
    ip_address = Column(String(200), nullable=True)          # CF-Ray + Land + IP

    # Beziehung
    user = relationship("User")

    def __repr__(self):
        return f"<AuditLog {self.action} by {self.user_display_name}>"
