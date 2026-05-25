import uuid
from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, TimestampMixin


class SystemConfig(Base, TimestampMixin):
    """
    Systemkonfiguration — editierbare Key-Value-Paare.
    Beispiele: privacy_text_de, imprint_text_de, checklist_enabled
    """
    __tablename__ = "system_config"

    id  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    description = Column(String(300), nullable=True)

    def __repr__(self):
        return f"<SystemConfig {self.key}>"
