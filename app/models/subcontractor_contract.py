import uuid
from datetime import date, datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Float, Date, ForeignKey
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SubcontractorContract(Base):
    __tablename__ = "subcontractor_contracts"

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
    contractor_id: Mapped[Optional[str]] = mapped_column(
        String(),
        ForeignKey("contractors.id", ondelete="SET NULL"),
        nullable=True,
    )
    contract_number: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    contract_date: Mapped[Optional[date]] = mapped_column(Date(), nullable=True)
    # status: draft / approval / signed
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    advance_pct: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    guarantee_pct: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
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


class SubcontractorContractItem(Base):
    __tablename__ = "subcontractor_contract_items"

    id: Mapped[str] = mapped_column(
        String(),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    contract_id: Mapped[str] = mapped_column(
        String(),
        ForeignKey("subcontractor_contracts.id", ondelete="CASCADE"),
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
    quantity: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    unit_price: Mapped[float] = mapped_column(Float(), nullable=False, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
