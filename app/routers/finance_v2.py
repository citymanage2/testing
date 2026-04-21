"""Финансовый модуль v2: бюджет проекта, план/факт, П&У, прогноз."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project_budget_entry import ProjectBudgetEntry, ENTRY_TYPES, ENTRY_CATEGORIES
from app.schemas.phase5 import (
    BudgetEntryCreate, BudgetEntryUpdate, BudgetEntryResponse,
    ProjectPlanFactResponse, ProjectForecastResponse,
    CompanyPLResponse, CompanyProjectRowSchema, GrpCompletionSchema,
)
from app.services.plan_fact_service import (
    get_project_plan_fact, get_project_forecast, get_company_pl,
)

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_plan_fact_response(pf) -> ProjectPlanFactResponse:
    return ProjectPlanFactResponse(
        project_id=pf.project_id,
        plan_revenue=pf.plan_revenue,
        plan_cost=pf.plan_cost,
        plan_margin=pf.plan_margin,
        plan_margin_pct=pf.plan_margin_pct,
        actual_revenue_estimates=pf.actual_revenue_estimates,
        actual_cost_estimates=pf.actual_cost_estimates,
        budget_income_planned=pf.budget_income_planned,
        budget_income_actual=pf.budget_income_actual,
        budget_expense_planned=pf.budget_expense_planned,
        budget_expense_actual=pf.budget_expense_actual,
        total_revenue_plan=pf.total_revenue_plan,
        total_revenue_actual=pf.total_revenue_actual,
        total_cost_plan=pf.total_cost_plan,
        total_cost_actual=pf.total_cost_actual,
        profit_plan=pf.profit_plan,
        profit_actual=pf.profit_actual,
        grp=GrpCompletionSchema(
            total_stages=pf.grp.total_stages,
            done_stages=pf.grp.done_stages,
            completion_pct=pf.grp.completion_pct,
        ),
    )


# ─── Budget Entries CRUD ──────────────────────────────────────────────────────

@router.get("/projects/{project_id}/budget", response_model=list[BudgetEntryResponse])
async def list_budget_entries(
    project_id: str,
    entry_type: str | None = Query(None),
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(ProjectBudgetEntry).where(ProjectBudgetEntry.project_id == project_id)
    if entry_type:
        q = q.where(ProjectBudgetEntry.entry_type == entry_type)
    if category:
        q = q.where(ProjectBudgetEntry.category == category)
    rows = (await db.execute(q.order_by(ProjectBudgetEntry.planned_date, ProjectBudgetEntry.created_at))).scalars().all()
    return rows


@router.post("/projects/{project_id}/budget", response_model=BudgetEntryResponse, status_code=201)
async def create_budget_entry(
    project_id: str,
    body: BudgetEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if body.entry_type not in ENTRY_TYPES:
        raise HTTPException(status_code=422, detail=f"entry_type должен быть одним из: {ENTRY_TYPES}")
    if body.category not in ENTRY_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category должна быть одной из: {ENTRY_CATEGORIES}")

    entry = ProjectBudgetEntry(
        id=str(uuid.uuid4()),
        project_id=project_id,
        entry_type=body.entry_type,
        category=body.category,
        description=body.description,
        planned_amount=body.planned_amount,
        actual_amount=body.actual_amount,
        planned_date=body.planned_date,
        actual_date=body.actual_date,
        reference_type=body.reference_type,
        reference_id=body.reference_id,
        created_by=current_user.id,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/projects/{project_id}/budget/{entry_id}", response_model=BudgetEntryResponse)
async def update_budget_entry(
    project_id: str,
    entry_id: str,
    body: BudgetEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    entry = await db.get(ProjectBudgetEntry, entry_id)
    if not entry or entry.project_id != project_id:
        raise HTTPException(status_code=404, detail="Запись бюджета не найдена")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    entry.updated_at = _now()
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/projects/{project_id}/budget/{entry_id}", status_code=204)
async def delete_budget_entry(
    project_id: str,
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    entry = await db.get(ProjectBudgetEntry, entry_id)
    if not entry or entry.project_id != project_id:
        raise HTTPException(status_code=404, detail="Запись бюджета не найдена")
    await db.delete(entry)
    await db.commit()


# ─── Дашборды ────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/plan-fact", response_model=ProjectPlanFactResponse)
async def project_plan_fact(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Дашборд план/факт по проекту: сметы + бюджетные записи."""
    pf = await get_project_plan_fact(db, project_id)
    return _to_plan_fact_response(pf)


@router.get("/projects/{project_id}/forecast", response_model=ProjectForecastResponse)
async def project_forecast(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Прогноз до конца проекта: экстраполяция на основе % выполнения ГПР."""
    fc = await get_project_forecast(db, project_id)
    return ProjectForecastResponse(
        project_id=fc.project_id,
        completion_pct=fc.completion_pct,
        forecast_revenue=fc.forecast_revenue,
        forecast_cost=fc.forecast_cost,
        forecast_profit=fc.forecast_profit,
        remaining_revenue=fc.remaining_revenue,
        remaining_cost=fc.remaining_cost,
        overrun_risk=fc.overrun_risk,
    )


@router.get("/company/pl", response_model=CompanyPLResponse)
async def company_pl(
    project_ids: list[str] | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """П&У по всем или указанным проектам компании (для директора/финансиста)."""
    pl = await get_company_pl(db, project_ids)
    return CompanyPLResponse(
        projects=[
            CompanyProjectRowSchema(
                project_id=r.project_id,
                plan_revenue=r.plan_revenue,
                actual_revenue=r.actual_revenue,
                plan_cost=r.plan_cost,
                actual_cost=r.actual_cost,
                profit_plan=r.profit_plan,
                profit_actual=r.profit_actual,
                completion_pct=r.completion_pct,
            )
            for r in pl.projects
        ],
        total_plan_revenue=pl.total_plan_revenue,
        total_actual_revenue=pl.total_actual_revenue,
        total_plan_cost=pl.total_plan_cost,
        total_actual_cost=pl.total_actual_cost,
        total_profit_plan=pl.total_profit_plan,
        total_profit_actual=pl.total_profit_actual,
    )
