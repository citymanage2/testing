from typing import Optional
from sqlalchemy import String, Text, JSON, ForeignKey, Numeric, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class EstimateItem(Base):
    __tablename__ = "estimate_items"

    id: Mapped[str] = mapped_column(primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    position: Mapped[int]
    section: Mapped[str] = mapped_column(String(256), default="")
    type: Mapped[str] = mapped_column(String(64), default="")
    name: Mapped[str] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(64), default="")
    quantity: Mapped[float]
    work_price: Mapped[float] = mapped_column(default=0.0)
    mat_price: Mapped[float] = mapped_column(default=0.0)
    total: Mapped[float] = mapped_column(default=0.0)
    is_analogue: Mapped[bool] = mapped_column(default=False)
    is_optimized: Mapped[bool] = mapped_column(default=False)
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    original_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    row_type: Mapped[str] = mapped_column(String(16), default="item")
    sort_order: Mapped[float] = mapped_column(default=0.0)
    sale_price: Mapped[float] = mapped_column(default=0.0)
    position_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # ТЗ v1.0: price provenance and cross-source tracking (schema 3.1)
    is_estimated: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    qty_from_tz: Mapped[Optional[float]] = mapped_column(nullable=True)
    qty_from_project: Mapped[Optional[float]] = mapped_column(nullable=True)
    discrepancy: Mapped[bool] = mapped_column(Boolean, default=False)
    scan_math_error: Mapped[bool] = mapped_column(Boolean, default=False)
