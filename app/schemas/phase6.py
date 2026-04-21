"""Pydantic-схемы Фазы 6: алерты и ИИ-ассистент проекта."""
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator


class ProjectAlertSchema(BaseModel):
    alert_type: str          # overrun | overrun_risk | grp_overdue | no_price_source | estimate_no_cost
    severity: str            # critical | warning | info
    message: str
    data: dict[str, Any] = Field(default_factory=dict)


class ProjectAlertsResponse(BaseModel):
    project_id: str
    alerts: list[ProjectAlertSchema]
    critical_count: int
    warning_count: int
    info_count: int


_VALID_MODULES = {"estimate", "grp", "warehouse", "finance"}


class AssistantRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    module: Optional[str] = None   # estimate | grp | warehouse | finance | None

    @field_validator("module")
    @classmethod
    def validate_module(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_MODULES:
            raise ValueError(f"module должен быть одним из: {sorted(_VALID_MODULES)}")
        return v


class AssistantResponse(BaseModel):
    answer: str
