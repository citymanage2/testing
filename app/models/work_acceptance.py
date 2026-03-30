import uuid
from datetime import datetime, timezone, date
from sqlalchemy import String, Text, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SubcontractorAssignment(Base):
    __tablename__ = "subcontractor_assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    estimate_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    contractor_id: Mapped[str] = mapped_column(String, ForeignKey("contractors.id", ondelete="CASCADE"), nullable=False)
    scope_type: Mapped[str] = mapped_column(String(16), default="section")  # section|item|all
    scope_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WorkAcceptance(Base):
    __tablename__ = "work_acceptances"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    estimate_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    contractor_id: Mapped[str | None] = mapped_column(String, ForeignKey("contractors.id", ondelete="SET NULL"), nullable=True)
    act_number: Mapped[str] = mapped_column(String(64), default="1")
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft")  # draft|accepted|rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WorkAcceptanceItem(Base):
    __tablename__ = "work_acceptance_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    acceptance_id: Mapped[str] = mapped_column(String, ForeignKey("work_acceptances.id", ondelete="CASCADE"), nullable=False)
    estimate_item_id: Mapped[str] = mapped_column(String, ForeignKey("estimate_items.id", ondelete="CASCADE"), nullable=False)
    quantity_accepted: Mapped[float] = mapped_column(Float, default=0.0)
