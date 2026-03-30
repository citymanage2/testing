from datetime import datetime, timezone
from sqlalchemy import Integer, String, LargeBinary, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ProjectGallery(Base):
    __tablename__ = "project_gallery"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(256), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    caption: Mapped[str | None] = mapped_column(String(512), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    uploaded_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
