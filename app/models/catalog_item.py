import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Text, Boolean, DateTime, Date, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

ITEM_TYPES = ("work", "material")


class CatalogItem(Base):
    """Единый каталог работ и материалов компании."""
    __tablename__ = "catalog_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # NULL = системный
    item_type: Mapped[str] = mapped_column(String(16), nullable=False)  # work|material
    code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[str] = mapped_column(String(64), nullable=False, default="шт")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    subcategory: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class CatalogPrice(Base):
    """Цена позиции каталога из конкретного источника на конкретную дату."""
    __tablename__ = "catalog_prices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    catalog_item_id: Mapped[str] = mapped_column(String, ForeignKey("catalog_items.id", ondelete="CASCADE"), nullable=False, index=True)
    price_source_id: Mapped[str] = mapped_column(String, ForeignKey("price_sources.id", ondelete="RESTRICT"), nullable=False)
    work_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    material_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
