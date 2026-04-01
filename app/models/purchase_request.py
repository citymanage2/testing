import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Float, ForeignKey
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

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
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    # status: draft / submitted / approved / ordered / delivered / cancelled
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    requested_by: Mapped[Optional[str]] = mapped_column(
        String(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PurchaseRequestItem(Base):
    __tablename__ = "purchase_request_items"

    id: Mapped[str] = mapped_column(
        String(),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    request_id: Mapped[str] = mapped_column(
        String(),
        ForeignKey("purchase_requests.id", ondelete="CASCADE"),
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
    quantity_requested: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    quantity_delivered: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    supplier_id: Mapped[Optional[str]] = mapped_column(
        String(),
        ForeignKey("contractors.id", ondelete="SET NULL"),
        nullable=True,
    )
    unit_price: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
