"""ГПР — этапы (графика производства работ) проекта v2."""
import uuid
from datetime import datetime, timezone, date
from typing import Optional
from sqlalchemy import String, Text, Date, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

STAGE_STATUSES = ("planned", "in_progress", "done", "blocked")


class WorkStage(Base):
    """Этап ГПР. Поддерживает вложенность и зависимости между этапами."""
    __tablename__ = "work_stages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("work_stages.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="planned")

    plan_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    plan_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    actual_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    actual_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # JSON-список ID этапов, от которых зависит этот этап
    depends_on: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
