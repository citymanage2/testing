"""Склад v2: центральный и объектные склады, остатки, движения."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

WAREHOUSE_TYPES = ("central", "site")
MOVEMENT_TYPES = ("receipt", "issue", "transfer", "write_off")


class Warehouse(Base):
    """Склад компании (центральный) или объектный (привязан к проекту)."""
    __tablename__ = "warehouses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    warehouse_type: Mapped[str] = mapped_column(String(16), nullable=False, default="central")  # central|site
    project_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WarehouseStock(Base):
    """Текущий остаток позиции каталога на складе."""
    __tablename__ = "warehouse_stock"
    __table_args__ = (UniqueConstraint("warehouse_id", "catalog_item_id", name="uq_stock_warehouse_item"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    warehouse_id: Mapped[str] = mapped_column(String, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    catalog_item_id: Mapped[str] = mapped_column(String, ForeignKey("catalog_items.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    reserved_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    unit: Mapped[str] = mapped_column(String(64), nullable=False, default="шт")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class StockMovement(Base):
    """Движение материала по складам (приход, расход, перемещение, списание)."""
    __tablename__ = "stock_movements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    warehouse_id: Mapped[str] = mapped_column(String, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    from_warehouse_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True)
    catalog_item_id: Mapped[str] = mapped_column(String, ForeignKey("catalog_items.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    movement_type: Mapped[str] = mapped_column(String(16), nullable=False)  # receipt|issue|transfer|write_off
    # Привязка к документу-основанию
    reference_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)   # material_request | manual
    reference_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
