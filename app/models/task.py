from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

TASK_TYPES = [
    "LIST_FROM_TZ", "LIST_FROM_TZ_PROJECT", "LIST_FROM_PROJECT",
    "RESEARCH_PROJECT", "SMETA_FROM_LIST", "SMETA_FROM_TZ",
    "SMETA_FROM_TZ_PROJECT", "SMETA_FROM_PROJECT", "SMETA_FROM_EDC_PROJECT",
    "SMETA_FROM_GRAND_PROJECT", "SCAN_TO_EXCEL", "COMPARE_PROJECT_SMETA", "IMPORT_EXCEL",
]

ALLOWED_MIME_TYPES = {
    t: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/xml", "application/xml",
        "image/jpeg", "image/png", "image/tiff",
    ]
    for t in TASK_TYPES
}


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(primary_key=True)
    task_type: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id"), nullable=True)
    user_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chat_history: Mapped[list] = mapped_column(JSON, default=list)
    progress_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    doc_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    estimate_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    estimate_status_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    estimate_status_updated_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    extras: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
