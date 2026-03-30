import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Contractor(Base):
    __tablename__ = "contractors"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), default="client")  # client|supplier|subcontractor
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    inn: Mapped[str | None] = mapped_column(String(12), nullable=True)
    kpp: Mapped[str | None] = mapped_column(String(9), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact: Mapped[str | None] = mapped_column(String(256), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
