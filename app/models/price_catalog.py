import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, JSON, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class PriceCatalog(Base):
    __tablename__ = "price_catalog"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    item_type: Mapped[str] = mapped_column(String(32), default="work")  # work|material
    name: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(64), nullable=True)
    work_price: Mapped[float] = mapped_column(Float, default=0.0)
    mat_price: Mapped[float] = mapped_column(Float, default=0.0)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
