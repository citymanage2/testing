from typing import Optional
from sqlalchemy import String, Text, JSON, ForeignKey, Numeric
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
    original_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
