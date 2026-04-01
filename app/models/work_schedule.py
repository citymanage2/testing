import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Float, Integer, ForeignKey, UniqueConstraint
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class WorkScheduleItem(Base):
    __tablename__ = "work_schedule_items"

    id: Mapped[str] = mapped_column(
        String(),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    project_id: Mapped[str] = mapped_column(
        String(),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    estimate_item_id: Mapped[Optional[str]] = mapped_column(
        String(),
        ForeignKey("estimate_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    total_quantity: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    sort_order: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class WorkScheduleEntry(Base):
    __tablename__ = "work_schedule_entries"
    __table_args__ = (
        UniqueConstraint(
            "schedule_item_id",
            "period_label",
            name="uq_work_sched_entry_item_period",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    schedule_item_id: Mapped[str] = mapped_column(
        String(),
        ForeignKey("work_schedule_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # e.g. '2024-W01' for week or '2024-03' for month
    period_label: Mapped[str] = mapped_column(String(32), nullable=False)
    # week / month
    period_type: Mapped[str] = mapped_column(String(8), nullable=False, default="month")
    planned_qty: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    actual_qty: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
