from sqlalchemy import Column, DateTime, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Gemeinsame Basis für alle Modelle."""
    pass


class TimestampMixin:
    """Fügt created_at und updated_at automatisch zu jedem Modell hinzu."""
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
