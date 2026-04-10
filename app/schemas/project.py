from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskInProject(BaseModel):
    id: str
    task_type: str
    status: str
    estimate_status: Optional[str]
    estimate_type: Optional[str] = None
    parent_estimate_id: Optional[str] = None
    calculation_method: Optional[str] = None
    name: Optional[str] = None
    created_at: datetime


class ProjectDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    tasks: list[TaskInProject]
