"""Финансовые записи проекта: плановые и фактические доходы/расходы."""
import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Text, DateTime, Date, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

ENTRY_TYPES = ("income", "expense")
ENTRY_CATEGORIES = (
    "client_payment",     # доход: оплата от заказчика
    "subcontractor",      # расход: оплата субподрядчику
    "materials",          # расход: закупка материалов
    "labor",              # расход: ФОТ бригад
    "equipment",          # расход: аренда/амортизация техники
    "overhead",           # расход: накладные (офис, логистика)
    "other",              # прочее
)


class ProjectBudgetEntry(Base):
    """Строка бюджета проекта: план и факт по одной статье."""
    __tablename__ = "project_budget_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_type: Mapped[str] = mapped_column(String(16), nullable=False)     # income|expense
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="other")

    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    planned_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False, default=0)
    actual_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False, default=0)

    planned_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    actual_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Ссылка на документ-основание (estimate, material_request, manual)
    reference_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_by: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
