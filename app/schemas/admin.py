from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class AdminTaskResponse(BaseModel):
    id: UUID
    task_type: str
    status: str
    estimate_status: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class AdminTaskDetail(BaseModel):
    id: UUID
    task_type: str
    status: str
    user_prompt: str | None
    chat_history: list
    progress_message: str | None
    error_message: str | None
    estimate_status: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class PriceListInfo(BaseModel):
    works: dict | None
    materials: dict | None
