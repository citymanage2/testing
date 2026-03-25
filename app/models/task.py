import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

TASK_TYPES = {
    "LIST_FROM_TZ",
    "LIST_FROM_TZ_PROJECT",
    "LIST_FROM_PROJECT",
    "RESEARCH_PROJECT",
    "SMETA_FROM_LIST",
    "SMETA_FROM_TZ",
    "SMETA_FROM_TZ_PROJECT",
    "SMETA_FROM_PROJECT",
    "SMETA_FROM_EDC_PROJECT",
    "SMETA_FROM_GRAND_PROJECT",
    "SCAN_TO_EXCEL",
    "COMPARE_PROJECT_SMETA",
}

ALLOWED_MIME_TYPES = {
    "LIST_FROM_TZ": ["application/pdf", "image/jpeg", "image/png"],
    "LIST_FROM_TZ_PROJECT": ["application/pdf", "image/jpeg", "image/png"],
    "LIST_FROM_PROJECT": ["application/pdf", "image/jpeg", "image/png"],
    "RESEARCH_PROJECT": ["application/pdf", "image/jpeg", "image/png"],
    "SMETA_FROM_LIST": [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ],
    "SMETA_FROM_TZ": ["application/pdf", "image/jpeg", "image/png"],
    "SMETA_FROM_TZ_PROJECT": ["application/pdf", "image/jpeg", "image/png"],
    "SMETA_FROM_PROJECT": ["application/pdf", "image/jpeg", "image/png"],
    "SMETA_FROM_EDC_PROJECT": ["application/pdf", "text/xml", "application/xml"],
    "SMETA_FROM_GRAND_PROJECT": ["application/pdf", "text/xml", "application/xml"],
    "SCAN_TO_EXCEL": ["application/pdf", "image/jpeg", "image/png"],
    "COMPARE_PROJECT_SMETA": [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
}

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    user_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    chat_history: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    progress_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    estimate_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    estimate_status_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estimate_status_updated_by: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="tasks")
    project: Mapped["Project"] = relationship(back_populates="tasks")
    input_files: Mapped[list["TaskInputFile"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="TaskInputFile.file_index"
    )
    results: Mapped[list["TaskResult"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )
    versions: Mapped[list["TaskVersion"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )
    estimate_items: Mapped[list["EstimateItem"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="EstimateItem.position"
    )
