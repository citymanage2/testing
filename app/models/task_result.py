from datetime import datetime, timezone
from sqlalchemy import ForeignKey, LargeBinary, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TaskResult(Base):
    __tablename__ = "task_results"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    file_name: Mapped[str] = mapped_column(String(256))
    file_data: Mapped[bytes] = mapped_column(LargeBinary)
    mime_type: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
