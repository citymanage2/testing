from datetime import datetime, timezone
from sqlalchemy import ForeignKey, JSON, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TaskVersion(Base):
    __tablename__ = "task_versions"

    id: Mapped[str] = mapped_column(primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int]
    snapshot: Mapped[list] = mapped_column(JSON)
    change_type: Mapped[str] = mapped_column(String(64))
    change_description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
