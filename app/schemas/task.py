from datetime import datetime
from pydantic import BaseModel


class TaskStatusResponse(BaseModel):
    id: str
    task_type: str
    status: str
    name: str | None = None
    doc_type: str | None = None
    progress_message: str | None
    error_message: str | None
    estimate_status: str | None
    created_at: datetime
    updated_at: datetime


class TaskNameUpdate(BaseModel):
    name: str | None = None


class TaskDocTypeUpdate(BaseModel):
    doc_type: str | None = None


class MessageRequest(BaseModel):
    content: str


class TaskResultFile(BaseModel):
    id: int
    file_name: str
    mime_type: str
    created_at: datetime
