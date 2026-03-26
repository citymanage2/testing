from sqlalchemy import ForeignKey, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class TaskInputFile(Base):
    __tablename__ = "task_input_files"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    file_index: Mapped[int]
    file_name: Mapped[str] = mapped_column(String(256))
    mime_type: Mapped[str] = mapped_column(String(128))
    file_data: Mapped[bytes] = mapped_column(LargeBinary)
    size_bytes: Mapped[int]
