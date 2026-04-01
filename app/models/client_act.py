import uuid
from datetime import date, datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Float, Date, ForeignKey
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ClientKs2Act(Base):
    __tablename__ = "client_ks2_acts"

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
    act_number: Mapped[str] = mapped_column(String(64), nullable=False, default="1")
    period_start: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)
    period_end: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)
    # status: draft / sent / revision / signed / cancelled
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    contractor_id: Mapped[Optional[str]] = mapped_column(
        String(),
        ForeignKey("contractors.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    signed_at: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)


class ClientKs2ActItem(Base):
    __tablename__ = "client_ks2_act_items"

    id: Mapped[str] = mapped_column(
        String(),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    act_id: Mapped[str] = mapped_column(
        String(),
        ForeignKey("client_ks2_acts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    estimate_item_id: Mapped[Optional[str]] = mapped_column(
        String(),
        ForeignKey("estimate_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    quantity_presented: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    unit_price: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
