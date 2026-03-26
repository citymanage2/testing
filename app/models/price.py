from datetime import datetime, timezone
from sqlalchemy import String, JSON, LargeBinary, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class PriceList(Base):
    __tablename__ = "price_lists"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(32))
    filename: Mapped[str] = mapped_column(String(256))
    content: Mapped[bytes] = mapped_column(LargeBinary)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PriceWork(Base):
    __tablename__ = "price_works"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    unit: Mapped[str] = mapped_column(String(64), default="")
    prices: Mapped[dict] = mapped_column(JSON, default=dict)
    min_price: Mapped[float] = mapped_column(default=0.0)


class PriceMaterial(Base):
    __tablename__ = "price_materials"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    unit: Mapped[str] = mapped_column(String(64), default="")
    price: Mapped[float] = mapped_column(default=0.0)
