"""Pydantic-схемы Фазы 5: финансовая картина (план/факт, П&У, прогноз)."""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


# ─── ProjectBudgetEntry ───────────────────────────────────────────────────────

class BudgetEntryCreate(BaseModel):
    entry_type: str                  # income | expense
    category: str = "other"
    description: Optional[str] = None
    planned_amount: Decimal = Field(Decimal("0"), ge=Decimal("0"))
    actual_amount: Decimal = Field(Decimal("0"), ge=Decimal("0"))
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None


class BudgetEntryUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    planned_amount: Optional[Decimal] = None
    actual_amount: Optional[Decimal] = None
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None


class BudgetEntryResponse(BaseModel):
    id: str
    project_id: str
    entry_type: str
    category: str
    description: Optional[str]
    planned_amount: Decimal
    actual_amount: Decimal
    planned_date: Optional[date]
    actual_date: Optional[date]
    reference_type: Optional[str]
    reference_id: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── GRP Completion ───────────────────────────────────────────────────────────

class GrpCompletionSchema(BaseModel):
    total_stages: int
    done_stages: int
    completion_pct: Decimal


# ─── Plan/Fact ────────────────────────────────────────────────────────────────

class ProjectPlanFactResponse(BaseModel):
    project_id: str
    plan_revenue: Decimal
    plan_cost: Decimal
    plan_margin: Decimal
    plan_margin_pct: Decimal
    actual_revenue_estimates: Decimal
    actual_cost_estimates: Decimal
    budget_income_planned: Decimal
    budget_income_actual: Decimal
    budget_expense_planned: Decimal
    budget_expense_actual: Decimal
    total_revenue_plan: Decimal
    total_revenue_actual: Decimal
    total_cost_plan: Decimal
    total_cost_actual: Decimal
    profit_plan: Decimal
    profit_actual: Decimal
    grp: GrpCompletionSchema


# ─── Forecast ────────────────────────────────────────────────────────────────

class ProjectForecastResponse(BaseModel):
    project_id: str
    completion_pct: Decimal
    forecast_revenue: Decimal
    forecast_cost: Decimal
    forecast_profit: Decimal
    remaining_revenue: Decimal
    remaining_cost: Decimal
    overrun_risk: Decimal          # >0 = есть риск перерасхода


# ─── Company P&L ─────────────────────────────────────────────────────────────

class CompanyProjectRowSchema(BaseModel):
    project_id: str
    plan_revenue: Decimal
    actual_revenue: Decimal
    plan_cost: Decimal
    actual_cost: Decimal
    profit_plan: Decimal
    profit_actual: Decimal
    completion_pct: Decimal


class CompanyPLResponse(BaseModel):
    projects: list[CompanyProjectRowSchema]
    total_plan_revenue: Decimal
    total_actual_revenue: Decimal
    total_plan_cost: Decimal
    total_actual_cost: Decimal
    total_profit_plan: Decimal
    total_profit_actual: Decimal
