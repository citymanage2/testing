import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Integer, Boolean, ForeignKey, LargeBinary
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ProjectDocument(Base):
    __tablename__ = "project_documents"

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
    # category: tz / design / incoming_estimate / tu / other
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="other")
    file_name: Mapped[str] = mapped_column(String(256), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_data: Mapped[bytes] = mapped_column(LargeBinary(), nullable=False)
    version: Mapped[int] = mapped_column(Integer(), nullable=False, default=1)
    # status: received / pending / not_required
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="received")
    comment: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    uploaded_by: Mapped[Optional[str]] = mapped_column(
        String(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    is_latest: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
