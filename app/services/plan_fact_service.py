"""Финансовый план/факт: агрегация по проекту и компании.

Вся арифметика — Python/SQL, без ИИ.

Источники данных:
  Плановые суммы — price_layers (client/cost) по подписанным сметам проекта
  Фактические суммы — price_layers (actual) + project_budget_entries (actual_amount)
  Завершённость ГПР — work_stages (status == done / total)
"""
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.models.estimate_v2 import Estimate, EstimatePosition, PriceLayer
from app.models.work_stage import WorkStage
from app.models.project_budget_entry import ProjectBudgetEntry

_ZERO = Decimal("0")
_PLAN_STATUSES = ("internal", "to_client", "signed")  # сметы, которые учитываем в плане


# ── Структуры данных ──────────────────────────────────────────────────────────

@dataclass
class LayerAmounts:
    revenue: Decimal = field(default_factory=lambda: _ZERO)  # CLIENT слой
    cost: Decimal = field(default_factory=lambda: _ZERO)      # COST слой
    subcontract: Decimal = field(default_factory=lambda: _ZERO)
    actual: Decimal = field(default_factory=lambda: _ZERO)    # ACTUAL слой


@dataclass
class GrpCompletion:
    total_stages: int = 0
    done_stages: int = 0
    completion_pct: Decimal = field(default_factory=lambda: _ZERO)


@dataclass
class ProjectPlanFact:
    project_id: str

    # ── Из смет ─────────────────────────────────────────────────────────────
    plan_revenue: Decimal = field(default_factory=lambda: _ZERO)
    plan_cost: Decimal = field(default_factory=lambda: _ZERO)
    plan_margin: Decimal = field(default_factory=lambda: _ZERO)
    plan_margin_pct: Decimal = field(default_factory=lambda: _ZERO)

    actual_revenue_estimates: Decimal = field(default_factory=lambda: _ZERO)  # ACTUAL из смет
    actual_cost_estimates: Decimal = field(default_factory=lambda: _ZERO)

    # ── Из бюджетных записей ────────────────────────────────────────────────
    budget_income_planned: Decimal = field(default_factory=lambda: _ZERO)
    budget_income_actual: Decimal = field(default_factory=lambda: _ZERO)
    budget_expense_planned: Decimal = field(default_factory=lambda: _ZERO)
    budget_expense_actual: Decimal = field(default_factory=lambda: _ZERO)

    # ── Итог план/факт (сметы + бюджет) ────────────────────────────────────
    total_revenue_plan: Decimal = field(default_factory=lambda: _ZERO)
    total_revenue_actual: Decimal = field(default_factory=lambda: _ZERO)
    total_cost_plan: Decimal = field(default_factory=lambda: _ZERO)
    total_cost_actual: Decimal = field(default_factory=lambda: _ZERO)
    profit_plan: Decimal = field(default_factory=lambda: _ZERO)
    profit_actual: Decimal = field(default_factory=lambda: _ZERO)

    grp: GrpCompletion = field(default_factory=GrpCompletion)


@dataclass
class ProjectForecast:
    project_id: str
    completion_pct: Decimal = field(default_factory=lambda: _ZERO)
    forecast_revenue: Decimal = field(default_factory=lambda: _ZERO)   # ожидаемый итог по выручке
    forecast_cost: Decimal = field(default_factory=lambda: _ZERO)
    forecast_profit: Decimal = field(default_factory=lambda: _ZERO)
    remaining_revenue: Decimal = field(default_factory=lambda: _ZERO)
    remaining_cost: Decimal = field(default_factory=lambda: _ZERO)
    overrun_risk: Decimal = field(default_factory=lambda: _ZERO)        # перерасход себестоимости (>0 = есть риск)


@dataclass
class CompanyProjectRow:
    project_id: str
    plan_revenue: Decimal = field(default_factory=lambda: _ZERO)
    actual_revenue: Decimal = field(default_factory=lambda: _ZERO)
    plan_cost: Decimal = field(default_factory=lambda: _ZERO)
    actual_cost: Decimal = field(default_factory=lambda: _ZERO)
    profit_plan: Decimal = field(default_factory=lambda: _ZERO)
    profit_actual: Decimal = field(default_factory=lambda: _ZERO)
    completion_pct: Decimal = field(default_factory=lambda: _ZERO)


@dataclass
class CompanyPL:
    projects: list[CompanyProjectRow] = field(default_factory=list)
    total_plan_revenue: Decimal = field(default_factory=lambda: _ZERO)
    total_actual_revenue: Decimal = field(default_factory=lambda: _ZERO)
    total_plan_cost: Decimal = field(default_factory=lambda: _ZERO)
    total_actual_cost: Decimal = field(default_factory=lambda: _ZERO)
    total_profit_plan: Decimal = field(default_factory=lambda: _ZERO)
    total_profit_actual: Decimal = field(default_factory=lambda: _ZERO)


# ── Вспомогательные запросы ───────────────────────────────────────────────────

async def _get_layer_totals(db: AsyncSession, project_id: str) -> LayerAmounts:
    """Агрегирует суммы по слоям цен из смет проекта (статусы: internal/to_client/signed)."""
    rows = (await db.execute(
        select(
            PriceLayer.layer_type,
            func.coalesce(func.sum(PriceLayer.total), 0).label("total"),
        )
        .select_from(PriceLayer)
        .join(EstimatePosition, EstimatePosition.id == PriceLayer.position_id)
        .join(Estimate, Estimate.id == EstimatePosition.estimate_id)
        .where(
            Estimate.project_id == project_id,
            Estimate.status.in_(_PLAN_STATUSES),
        )
        .group_by(PriceLayer.layer_type)
    )).all()

    amounts = LayerAmounts()
    for row in rows:
        val = Decimal(str(row.total))
        if row.layer_type == "client":
            amounts.revenue = val
        elif row.layer_type == "cost":
            amounts.cost = val
        elif row.layer_type == "subcontract":
            amounts.subcontract = val
        elif row.layer_type == "actual":
            amounts.actual = val
    return amounts


async def _get_budget_totals(db: AsyncSession, project_id: str) -> dict:
    """Агрегирует плановые/фактические суммы из project_budget_entries."""
    rows = (await db.execute(
        select(
            ProjectBudgetEntry.entry_type,
            func.coalesce(func.sum(ProjectBudgetEntry.planned_amount), 0).label("planned"),
            func.coalesce(func.sum(ProjectBudgetEntry.actual_amount), 0).label("actual"),
        )
        .where(ProjectBudgetEntry.project_id == project_id)
        .group_by(ProjectBudgetEntry.entry_type)
    )).all()

    result = {
        "income_planned": _ZERO, "income_actual": _ZERO,
        "expense_planned": _ZERO, "expense_actual": _ZERO,
    }
    for row in rows:
        if row.entry_type == "income":
            result["income_planned"] = Decimal(str(row.planned))
            result["income_actual"] = Decimal(str(row.actual))
        elif row.entry_type == "expense":
            result["expense_planned"] = Decimal(str(row.planned))
            result["expense_actual"] = Decimal(str(row.actual))
    return result


async def _get_grp_completion(db: AsyncSession, project_id: str) -> GrpCompletion:
    """Считает % выполнения ГПР по статусам этапов.

    Учитываем только листовые этапы (те, которые не являются parent_id ни для одного другого этапа).
    Это предотвращает двойной счёт: родительский этап не суммируется вместе с детьми.
    """
    # Подзапрос: ID этапов, которые являются родителями (имеют дочерние)
    parent_ids_sq = (
        select(WorkStage.parent_id)
        .where(WorkStage.project_id == project_id)
        .where(WorkStage.parent_id.is_not(None))
        .scalar_subquery()
    )

    rows = (await db.execute(
        select(
            WorkStage.status,
            func.count(WorkStage.id).label("cnt"),
        )
        .where(WorkStage.project_id == project_id)
        .where(WorkStage.id.not_in(parent_ids_sq))
        .group_by(WorkStage.status)
    )).all()

    total = sum(r.cnt for r in rows)
    done = sum(r.cnt for r in rows if r.status == "done")
    pct = (Decimal(done) / Decimal(total) * 100).quantize(Decimal("0.01")) if total else _ZERO
    return GrpCompletion(total_stages=total, done_stages=done, completion_pct=pct)


# ── Публичные функции ─────────────────────────────────────────────────────────

async def get_project_plan_fact(db: AsyncSession, project_id: str) -> ProjectPlanFact:
    """Полный план/факт по проекту: сметы + бюджетные записи."""
    layers = await _get_layer_totals(db, project_id)
    budget = await _get_budget_totals(db, project_id)
    grp = await _get_grp_completion(db, project_id)

    plan_margin = layers.revenue - layers.cost
    plan_margin_pct = (
        (plan_margin / layers.revenue * 100).quantize(Decimal("0.01"))
        if layers.revenue else _ZERO
    )

    total_revenue_plan = layers.revenue + budget["income_planned"]
    total_revenue_actual = layers.actual + budget["income_actual"]
    total_cost_plan = layers.cost + budget["expense_planned"]
    total_cost_actual = budget["expense_actual"]  # фактические расходы только из budget entries

    return ProjectPlanFact(
        project_id=project_id,
        plan_revenue=layers.revenue,
        plan_cost=layers.cost,
        plan_margin=plan_margin,
        plan_margin_pct=plan_margin_pct,
        actual_revenue_estimates=layers.actual,
        actual_cost_estimates=_ZERO,
        budget_income_planned=budget["income_planned"],
        budget_income_actual=budget["income_actual"],
        budget_expense_planned=budget["expense_planned"],
        budget_expense_actual=budget["expense_actual"],
        total_revenue_plan=total_revenue_plan,
        total_revenue_actual=total_revenue_actual,
        total_cost_plan=total_cost_plan,
        total_cost_actual=total_cost_actual,
        profit_plan=total_revenue_plan - total_cost_plan,
        profit_actual=total_revenue_actual - total_cost_actual,
        grp=grp,
    )


async def get_project_forecast(
    db: AsyncSession,
    project_id: str,
    _pf: Optional[ProjectPlanFact] = None,
) -> ProjectForecast:
    """Прогноз до конца проекта на основе % выполнения ГПР и отклонений по факту.

    Принимает опциональный _pf чтобы избежать повторного запроса к БД,
    если вызывающий код уже загрузил plan_fact (например, get_project_alerts).
    """
    pf = _pf if _pf is not None else await get_project_plan_fact(db, project_id)
    comp = pf.grp.completion_pct / 100  # 0..1

    if comp <= _ZERO:
        # ГПР не начат: прогноз = план
        return ProjectForecast(
            project_id=project_id,
            completion_pct=pf.grp.completion_pct,
            forecast_revenue=pf.total_revenue_plan,
            forecast_cost=pf.total_cost_plan,
            forecast_profit=pf.profit_plan,
            remaining_revenue=pf.total_revenue_plan,
            remaining_cost=pf.total_cost_plan,
        )

    # Расход на единицу выполнения
    cost_per_unit = (pf.total_cost_actual / comp) if comp > _ZERO else pf.total_cost_plan
    forecast_cost = cost_per_unit  # экстраполяция до 100%

    # Выручка: принимаем плановую (выручка фиксирована контрактом)
    forecast_revenue = pf.total_revenue_plan

    overrun = max(_ZERO, forecast_cost - pf.total_cost_plan)

    remaining_revenue = max(_ZERO, forecast_revenue - pf.total_revenue_actual)
    remaining_cost = max(_ZERO, forecast_cost - pf.total_cost_actual)

    return ProjectForecast(
        project_id=project_id,
        completion_pct=pf.grp.completion_pct,
        forecast_revenue=forecast_revenue.quantize(Decimal("0.01")),
        forecast_cost=forecast_cost.quantize(Decimal("0.01")),
        forecast_profit=(forecast_revenue - forecast_cost).quantize(Decimal("0.01")),
        remaining_revenue=remaining_revenue.quantize(Decimal("0.01")),
        remaining_cost=remaining_cost.quantize(Decimal("0.01")),
        overrun_risk=overrun.quantize(Decimal("0.01")),
    )


async def get_company_pl(db: AsyncSession, project_ids: Optional[list[str]] = None) -> CompanyPL:
    """П&У по всем (или указанным) проектам компании."""
    if project_ids is None:
        # Берём все уникальные project_id из смет
        ids_rows = (await db.execute(
            select(Estimate.project_id.distinct())
            .where(Estimate.status.in_(_PLAN_STATUSES))
        )).scalars().all()
        project_ids = list(ids_rows)

    pl = CompanyPL()
    for pid in project_ids:
        pf = await get_project_plan_fact(db, pid)
        row = CompanyProjectRow(
            project_id=pid,
            plan_revenue=pf.total_revenue_plan,
            actual_revenue=pf.total_revenue_actual,
            plan_cost=pf.total_cost_plan,
            actual_cost=pf.total_cost_actual,
            profit_plan=pf.profit_plan,
            profit_actual=pf.profit_actual,
            completion_pct=pf.grp.completion_pct,
        )
        pl.projects.append(row)
        pl.total_plan_revenue += row.plan_revenue
        pl.total_actual_revenue += row.actual_revenue
        pl.total_plan_cost += row.plan_cost
        pl.total_actual_cost += row.actual_cost
        pl.total_profit_plan += row.profit_plan
        pl.total_profit_actual += row.profit_actual

    return pl
