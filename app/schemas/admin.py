from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class AdminTaskResponse(BaseModel):
    id: str
    task_type: str
    status: str
    estimate_status: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        return cls(
            id=str(obj.id),
            task_type=obj.task_type,
            status=obj.status,
            estimate_status=obj.estimate_status,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


class AdminTaskDetail(BaseModel):
    id: str
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


class TasksPage(BaseModel):
    items: list[AdminTaskResponse]
    total: int
    page: int
    page_size: int


class PriceListInfo(BaseModel):
    works: dict | None
    materials: dict | None
