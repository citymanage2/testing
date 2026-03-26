from datetime import datetime
from pydantic import BaseModel


class TaskStatusResponse(BaseModel):
    id: str
    task_type: str
    status: str
    progress_message: str | None
    error_message: str | None
    estimate_status: str | None
    created_at: datetime
    updated_at: datetime


class MessageRequest(BaseModel):
    content: str


class TaskResultFile(BaseModel):
    id: int
    file_name: str
    mime_type: str
    created_at: datetime
