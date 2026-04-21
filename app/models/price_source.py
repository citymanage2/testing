import uuid
from datetime import datetime, timezone, date
from typing import Optional
from sqlalchemy import String, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

SOURCE_TYPES = ("pricelist", "fsnb", "internal", "manual")


class PriceSource(Base):
    __tablename__ = "price_sources"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)  # pricelist|fsnb|internal|manual
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
