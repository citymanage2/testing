from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None

class ProjectUpdate(BaseModel):
    name: str
    description: str | None = None

class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class TaskInProject(BaseModel):
    id: str
    task_type: str
    status: str
    estimate_status: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

class ProjectDetailResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    tasks: list[TaskInProject]
