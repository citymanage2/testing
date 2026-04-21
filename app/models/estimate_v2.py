import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, Numeric, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

ESTIMATE_STATUSES = ("draft", "internal", "to_client", "signed")
ESTIMATE_TYPES = ("client", "subcontract")
CALC_METHODS = ("manual", "ai")

# Допустимые переходы статусов сметы
ESTIMATE_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "draft":     ["internal"],
    "internal":  ["draft", "to_client"],
    "to_client": ["internal", "signed"],
    "signed":    ["to_client"],  # разблокировка — возврат на согласование
}


class Estimate(Base):
    """Смета v2 — центральная сущность сметного модуля."""
    __tablename__ = "estimates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Статусная машина
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)  # True после подписания

    # Ветвление/версии
    parent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("estimates.id", ondelete="SET NULL"), nullable=True)
    version_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Тип и метод
    estimate_type: Mapped[str] = mapped_column(String(32), nullable=False, default="client")  # client|subcontract
    calculation_method: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")  # manual|ai

    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Коэффициенты накладных расходов (overhead_pct, transport_pct, contingency_pct)
    extras: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class EstimateSection(Base):
    """Раздел сметы (поддерживает вложенность)."""
    __tablename__ = "estimate_sections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    estimate_id: Mapped[str] = mapped_column(String, ForeignKey("estimates.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("estimate_sections.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    order_index: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class EstimatePosition(Base):
    """Позиция (строка) сметы с несколькими слоями цен."""
    __tablename__ = "estimate_positions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    estimate_id: Mapped[str] = mapped_column(String, ForeignKey("estimates.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("estimate_sections.id", ondelete="SET NULL"), nullable=True)
    catalog_item_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("catalog_items.id", ondelete="SET NULL"), nullable=True)
    stage_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("work_stages.id", ondelete="SET NULL"), nullable=True)

    row_type: Mapped[str] = mapped_column(String(16), nullable=False, default="item")  # item|header|total
    name: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[str] = mapped_column(String(64), nullable=False, default="шт")
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=1)
    order_index: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class PriceLayer(Base):
    """Один из 4 слоёв цен на позицию сметы (заказчик/себестоимость/субподряд/факт)."""
    __tablename__ = "price_layers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    position_id: Mapped[str] = mapped_column(String, ForeignKey("estimate_positions.id", ondelete="CASCADE"), nullable=False, index=True)
    layer_type: Mapped[str] = mapped_column(String(32), nullable=False)  # client|cost|subcontract|actual

    work_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    material_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    # Обязательная ссылка на источник — технически NOT NULL рекомендован, но nullable для черновиков
    price_source_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("price_sources.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
