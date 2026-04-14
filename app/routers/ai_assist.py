import os

try:
    import anthropic
    _anthropic_available = True
except ImportError:
    _anthropic_available = False

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_current_user, owns_or_admin
from app.models.user import User
from app.models.task import Task
from app.models.estimate_item import EstimateItem

router = APIRouter()

_SYSTEM_PROMPT = (
    "Ты эксперт по строительным сметам. Помогай пользователю анализировать и улучшать сметы. "
    "Давай конкретные, практичные советы. Отвечай на русском языке."
)


class AiAssistRequest(BaseModel):
    prompt: str


def _build_context(items: list[EstimateItem]) -> str:
    total_work = sum(i.work_price * i.quantity for i in items)
    total_mat = sum(i.mat_price * i.quantity for i in items)
    sections = sorted({i.section for i in items if i.section})
    zero_price_items = [i.name for i in items if i.work_price == 0 and i.mat_price == 0]

    lines = [
        f"Количество позиций: {len(items)}",
        f"Суммарная стоимость работ: {total_work:,.2f} ₽",
        f"Суммарная стоимость материалов: {total_mat:,.2f} ₽",
    ]

    if sections:
        lines.append(f"Разделы сметы: {', '.join(sections)}")
    else:
        lines.append("Разделы сметы: не указаны")

    if zero_price_items:
        preview = zero_price_items[:10]
        suffix = f" (и ещё {len(zero_price_items) - 10})" if len(zero_price_items) > 10 else ""
        lines.append(f"Позиции с нулевой ценой: {', '.join(preview)}{suffix}")

    return "\n".join(lines)


def _rule_based_analysis(items: list[EstimateItem]) -> str:
    issues: list[str] = []

    # Items with zero work_price
    zero_work = [i.name for i in items if i.work_price == 0]
    if zero_work:
        preview = zero_work[:5]
        suffix = f" (и ещё {len(zero_work) - 5})" if len(zero_work) > 5 else ""
        issues.append(
            f"Позиции с нулевой ценой работ ({len(zero_work)} шт.): "
            f"{', '.join(preview)}{suffix}."
        )

    # Material items with zero mat_price
    zero_mat_materials = [i.name for i in items if i.type == "Материал" and i.mat_price == 0]
    if zero_mat_materials:
        preview = zero_mat_materials[:5]
        suffix = f" (и ещё {len(zero_mat_materials) - 5})" if len(zero_mat_materials) > 5 else ""
        issues.append(
            f"Материалы с нулевой ценой материалов ({len(zero_mat_materials)} шт.): "
            f"{', '.join(preview)}{suffix}."
        )

    # Missing sections
    no_section = [i.name for i in items if not i.section or not i.section.strip()]
    if no_section:
        issues.append(
            f"Позиции без указания раздела ({len(no_section)} шт.) — "
            "рекомендуется разбить смету на разделы для удобства чтения."
        )

    # Duplicate names
    name_counts: dict[str, int] = {}
    for i in items:
        name_counts[i.name] = name_counts.get(i.name, 0) + 1
    duplicates = [name for name, count in name_counts.items() if count > 1]
    if duplicates:
        preview = duplicates[:5]
        suffix = f" (и ещё {len(duplicates) - 5})" if len(duplicates) > 5 else ""
        issues.append(
            f"Повторяющиеся наименования ({len(duplicates)} шт.): "
            f"{', '.join(preview)}{suffix}."
        )

    if not issues:
        return (
            "Смета выглядит корректно: все позиции заполнены, разделы указаны, "
            "дублирований не обнаружено."
        )

    return "Обнаружены следующие проблемы в смете:\n" + "\n".join(f"• {issue}" for issue in issues)


@router.post("/estimates/{task_id}/ai-assist")
async def ai_assist(
    task_id: str,
    body: AiAssistRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify the task belongs to the current user
    task = await db.get(Task, task_id)
    if not task or not owns_or_admin(current_user, task.user_id):
        raise HTTPException(status_code=404, detail="Task not found")

    # 2. Load estimate items
    result = await db.execute(
        select(EstimateItem)
        .where(EstimateItem.task_id == task_id)
        .order_by(EstimateItem.sort_order, EstimateItem.position)
    )
    items = result.scalars().all()

    # 3. Build context string
    context = _build_context(items)
    user_message = f"Контекст сметы:\n{context}\n\nВопрос пользователя:\n{body.prompt}"

    # 4. Try Anthropic Claude API
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if _anthropic_available and api_key:
        try:
            client = anthropic.AsyncAnthropic(api_key=api_key)
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
            response_text = message.content[0].text
            return {"response": response_text, "used_ai": True}
        except anthropic.APIError:
            pass

    # 5. Fall back to rule-based analysis
    rule_response = _rule_based_analysis(items)
    return {"response": rule_response, "used_ai": False}
