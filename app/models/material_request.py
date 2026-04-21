"""Заявки на материалы v2 (от прораба/менеджера проекта → снабженцу)."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

REQUEST_STATUSES = ("draft", "submitted", "approved", "ordered", "delivered", "cancelled")


class MaterialRequest(Base):
    """Заявка на материалы для этапа/проекта."""
    __tablename__ = "material_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("work_stages.id", ondelete="SET NULL"), nullable=True)
    warehouse_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    requested_by: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class MaterialRequestItem(Base):
    """Строка заявки на материал."""
    __tablename__ = "material_request_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id: Mapped[str] = mapped_column(String, ForeignKey("material_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    catalog_item_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("catalog_items.id", ondelete="SET NULL"), nullable=True)
    estimate_position_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("estimate_positions.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    unit: Mapped[str] = mapped_column(String(64), nullable=False, default="шт")
    quantity_planned: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    quantity_actual: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
