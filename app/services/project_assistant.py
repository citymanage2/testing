"""ИИ-ассистент проекта: собирает контекст детерминированно, затем вызывает Claude.

Принципы:
- Сборка контекста — только SQL/Python (детерминированно, без ИИ).
- Claude отвечает на вопрос пользователя, используя готовый контекст.
- Алерты (перерасход, риски) считаются в alert_service, не здесь.
- Таймаут 60 с. При сбое — fallback с сообщением об ошибке.
- Используем HAIKU: контекст структурирован, вопросы короткие, высокий объём.
"""
import asyncio
import logging
from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.project import Project
from app.models.estimate_v2 import Estimate, EstimatePosition, PriceLayer
from app.models.work_stage import WorkStage
from app.models.material_request import MaterialRequest
from app.services.plan_fact_service import get_project_plan_fact
from app.services import claude_service

logger = logging.getLogger(__name__)

_ZERO = Decimal("0")
_ASSISTANT_TIMEOUT = 60  # секунды

_SYSTEM_PROMPT = (
    "Ты — ИИ-ассистент строительной компании. "
    "Тебе передаётся структурированный контекст проекта: сметы, ГПР, материалы, финансы. "
    "Отвечай строго по делу, ссылайся на конкретные данные из контекста. "
    "Не придумывай цифры, которых нет в контексте. "
    "Если данных недостаточно — скажи об этом прямо. "
    "Отвечай на русском языке."
)


async def build_project_context(db: AsyncSession, project_id: str) -> str:
    """Детерминированно собирает текстовый контекст проекта для передачи в Claude."""
    project = await db.get(Project, project_id)
    if not project:
        return f"Проект {project_id} не найден."

    lines: list[str] = [
        f"=== ПРОЕКТ: {project.name} ===",
        f"Статус: {project.status or '—'}",
        f"Адрес: {project.address or '—'}",
        f"Плановый бюджет: {project.budget_planned or '—'} руб.",
    ]
    if project.start_date:
        lines.append(f"Сроки: {project.start_date} — {project.end_date or 'не указан'}")

    # ── Сметы ────────────────────────────────────────────────────────────────
    est_rows = (await db.execute(
        select(Estimate.id, Estimate.name, Estimate.status)
        .where(Estimate.project_id == project_id)
        .order_by(Estimate.created_at.desc())
        .limit(10)
    )).all()

    if est_rows:
        lines.append(f"\n=== СМЕТЫ ({len(est_rows)} шт.) ===")
        for r in est_rows:
            lines.append(f"  • {r.name} [{r.status}]")

    # ── Финансовый план/факт ─────────────────────────────────────────────────
    try:
        pf = await get_project_plan_fact(db, project_id)
        lines.append("\n=== ПЛАН/ФАКТ ===")
        lines.append(f"  Плановая выручка: {pf.plan_revenue:,.2f} руб.")
        lines.append(f"  Плановая себестоимость: {pf.plan_cost:,.2f} руб.")
        if pf.plan_revenue > _ZERO:
            lines.append(
                f"  Плановая маржа: {pf.plan_margin:,.2f} руб. ({pf.plan_margin_pct:.1f}%)"
            )
        lines.append(f"  Фактические расходы: {pf.total_cost_actual:,.2f} руб.")
        lines.append(
            f"  Выполнение ГПР: {pf.grp.completion_pct:.1f}% "
            f"({pf.grp.done_stages} из {pf.grp.total_stages} этапов)"
        )
    except Exception as e:
        logger.warning("build_project_context: ошибка план/факт для %s: %s", project_id, e)

    # ── Просроченные этапы ГПР ───────────────────────────────────────────────
    today = date.today()
    overdue = (await db.execute(
        select(WorkStage.name, WorkStage.plan_end, WorkStage.status)
        .where(
            WorkStage.project_id == project_id,
            WorkStage.plan_end.is_not(None),
            WorkStage.plan_end < today,
            WorkStage.status.not_in(["done"]),
        )
        .order_by(WorkStage.plan_end)
        .limit(5)
    )).all()

    if overdue:
        lines.append(f"\n=== ПРОСРОЧЕННЫЕ ЭТАПЫ ГПР ({len(overdue)} шт.) ===")
        for r in overdue:
            lines.append(f"  • {r.name}: план до {r.plan_end}, статус «{r.status}»")

    # ── Заявки на материалы ──────────────────────────────────────────────────
    pending_count = (await db.execute(
        select(func.count(MaterialRequest.id))
        .where(
            MaterialRequest.project_id == project_id,
            MaterialRequest.status.in_(["submitted", "approved"]),
        )
    )).scalar() or 0

    if pending_count:
        lines.append(f"\n=== ЗАЯВКИ НА МАТЕРИАЛЫ ===")
        lines.append(f"  Ожидают обработки: {pending_count} заявок")

    return "\n".join(lines)


async def ask_project_assistant(
    db: AsyncSession,
    project_id: str,
    question: str,
    module: str | None = None,
) -> str:
    """
    Отвечает на вопрос пользователя в контексте проекта.

    Таймаут: 60 с. При сбое возвращает локализованное сообщение об ошибке.
    """
    context = await build_project_context(db, project_id)

    module_hint = f"\nПользователь работает в модуле: {module}." if module else ""

    messages = [
        {
            "role": "user",
            "content": (
                f"{context}{module_hint}\n\n"
                f"=== ВОПРОС ПОЛЬЗОВАТЕЛЯ ===\n{question}"
            ),
        }
    ]

    try:
        answer = await asyncio.wait_for(
            claude_service.complete(
                system=_SYSTEM_PROMPT,
                messages=messages,
                max_tokens=2000,
                model=claude_service.HAIKU,
            ),
            timeout=_ASSISTANT_TIMEOUT,
        )
        return answer
    except asyncio.TimeoutError:
        logger.warning("ask_project_assistant: таймаут (>%ds) для проекта %s", _ASSISTANT_TIMEOUT, project_id)
        return "Ассистент не ответил вовремя. Попробуйте позже или уточните вопрос."
    except Exception as e:
        logger.error("ask_project_assistant: ошибка Claude для проекта %s: %s", project_id, e)
        return "Ошибка ассистента. Попробуйте позже."
