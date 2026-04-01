import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Float, ForeignKey
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class KpRequest(Base):
    __tablename__ = "kp_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    estimate_item_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("estimate_items.id", ondelete="SET NULL"), nullable=True)
    supplier_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("contractors.id", ondelete="SET NULL"), nullable=True)
    item_name: Mapped[str] = mapped_column(String(256))
    unit: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
