"""Детерминированные алерты по проекту.

Все проверки — чистый SQL/Python. ИИ не используется.

Типы алертов:
  overrun         — фактические расходы превысили план (critical)
  overrun_risk    — прогноз выявил риск перерасхода (warning)
  grp_overdue     — просроченные этапы ГПР (warning)
  estimate_no_cost — сметы без себестоимости в активных статусах (warning)
  no_price_source — позиции без подтверждённой цены (info)
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.estimate_v2 import Estimate, EstimatePosition, PriceLayer
from app.models.work_stage import WorkStage
from app.services.plan_fact_service import get_project_plan_fact, get_project_forecast

_ZERO = Decimal("0")
_ACTIVE_STATUSES = ("internal", "to_client", "signed")


@dataclass
class ProjectAlert:
    alert_type: str
    severity: str      # critical | warning | info
    message: str
    data: dict = field(default_factory=dict)


async def get_project_alerts(db: AsyncSession, project_id: str) -> list[ProjectAlert]:
    """Возвращает список алертов по проекту. Порядок: critical → warning → info."""
    alerts: list[ProjectAlert] = []

    # Загружаем plan_fact один раз и передаём в forecast, чтобы избежать двойного запроса к БД
    pf = await get_project_plan_fact(db, project_id)
    fc = await get_project_forecast(db, project_id, _pf=pf)

    # ── 1. Перерасход: фактические расходы > план ────────────────────────────
    if pf.total_cost_plan > _ZERO and pf.total_cost_actual > pf.total_cost_plan:
        overrun = pf.total_cost_actual - pf.total_cost_plan
        alerts.append(ProjectAlert(
            alert_type="overrun",
            severity="critical",
            message=f"Фактические расходы превысили план на {overrun:,.2f} руб.",
            data={
                "plan_cost": str(pf.total_cost_plan),
                "actual_cost": str(pf.total_cost_actual),
                "overrun": str(overrun),
            },
        ))

    # ── 2. Прогнозируемый перерасход ─────────────────────────────────────────
    if fc.overrun_risk > _ZERO:
        alerts.append(ProjectAlert(
            alert_type="overrun_risk",
            severity="warning",
            message=(
                f"Прогноз выявил риск перерасхода: {fc.overrun_risk:,.2f} руб. "
                f"(при текущем темпе расходов)."
            ),
            data={
                "overrun_risk": str(fc.overrun_risk),
                "forecast_cost": str(fc.forecast_cost),
                "plan_cost": str(pf.total_cost_plan),
            },
        ))

    # ── 3. Просроченные этапы ГПР ────────────────────────────────────────────
    today = date.today()
    overdue_rows = (await db.execute(
        select(WorkStage.id, WorkStage.name, WorkStage.plan_end, WorkStage.status)
        .where(
            WorkStage.project_id == project_id,
            WorkStage.plan_end.is_not(None),
            WorkStage.plan_end < today,
            WorkStage.status.not_in(["done"]),
        )
        .order_by(WorkStage.plan_end)
        .limit(10)
    )).all()

    if overdue_rows:
        sample = ", ".join(r.name for r in overdue_rows[:3])
        alerts.append(ProjectAlert(
            alert_type="grp_overdue",
            severity="warning",
            message=f"Просрочено этапов ГПР: {len(overdue_rows)}. Например: {sample}.",
            data={
                "count": len(overdue_rows),
                "stages": [
                    {"id": r.id, "name": r.name, "plan_end": str(r.plan_end), "status": r.status}
                    for r in overdue_rows
                ],
            },
        ))

    # ── 4. Сметы без себестоимости в активных статусах ───────────────────────
    # Подзапрос: estimate_id-ы, у которых есть хотя бы один COST-слой
    has_cost_sq = (
        select(EstimatePosition.estimate_id)
        .join(PriceLayer, PriceLayer.position_id == EstimatePosition.id)
        .where(PriceLayer.layer_type == "cost")
        .distinct()
        .scalar_subquery()
    )
    no_cost_rows = (await db.execute(
        select(Estimate.id, Estimate.name, Estimate.status)
        .where(
            Estimate.project_id == project_id,
            Estimate.status.in_(_ACTIVE_STATUSES),
            Estimate.id.not_in(has_cost_sq),
        )
        .order_by(Estimate.created_at)
    )).all()

    if no_cost_rows:
        sample = ", ".join(r.name for r in no_cost_rows[:3])
        alerts.append(ProjectAlert(
            alert_type="estimate_no_cost",
            severity="warning",
            message=f"Сметы без себестоимости ({len(no_cost_rows)} шт.): {sample}.",
            data={
                "estimates": [
                    {"id": r.id, "name": r.name, "status": r.status}
                    for r in no_cost_rows
                ],
            },
        ))

    # ── 5. Позиции без подтверждённой цены (в активных сметах) ───────────────
    review_count = (await db.execute(
        select(func.count(EstimatePosition.id))
        .join(Estimate, Estimate.id == EstimatePosition.estimate_id)
        .join(PriceLayer, PriceLayer.position_id == EstimatePosition.id)
        .where(
            Estimate.project_id == project_id,
            Estimate.status.in_(_ACTIVE_STATUSES),
            PriceLayer.layer_type == "client",
            PriceLayer.notes == "требует проверки",
        )
    )).scalar() or 0

    if review_count > 0:
        alerts.append(ProjectAlert(
            alert_type="no_price_source",
            severity="info",
            message=f"Позиций без подтверждённой цены: {review_count}.",
            data={"count": review_count},
        ))

    return alerts
