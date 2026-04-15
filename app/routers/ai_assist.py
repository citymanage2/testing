import os
import json
import logging

try:
    import anthropic
    _anthropic_available = True
except ImportError:
    _anthropic_available = False

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_current_user, owns_or_admin
from app.models.user import User
from app.models.task import Task
from app.models.estimate_item import EstimateItem
from app.services import claude_service
from app.services.claude_service import SONNET

logger = logging.getLogger(__name__)
router = APIRouter()

_SYSTEM_PROMPT = (
    "Ты эксперт по строительным сметам. Помогай пользователю анализировать и улучшать сметы. "
    "Давай конкретные, практичные советы. Отвечай на русском языке."
)

_PRICE_FILL_SYSTEM = (
    "Ты эксперт-сметчик. Твоя задача — проставить реальные рыночные цены по каждой позиции. "
    "Используй актуальные рыночные цены России 2025-2026 года. "
    "Верни ТОЛЬКО строгий JSON без markdown-обёрток. "
    "Для каждой позиции: work_price — цена за единицу работы, mat_price — цена за единицу материала. "
    "Хотя бы одно из двух должно быть > 0. "
    "Укажи source (url источника или 'рыночная оценка') и comment (обоснование цены)."
)


class AiAssistRequest(BaseModel):
    prompt: str


class AiFillPricesRequest(BaseModel):
    item_ids: Optional[list[str]] = None   # None = все позиции с нулевой ценой
    prompt: Optional[str] = None           # регион, особые условия


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


@router.post("/estimates/{task_id}/ai-fill-prices")
async def ai_fill_prices(
    task_id: str,
    body: AiFillPricesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fill work_price / mat_price for selected (or all zero-price) estimate items using Claude.

    Steps:
      1. Code loads target items from DB.
      2. Claude receives the list and returns prices as JSON.
      3. Code validates and applies prices to DB (arithmetic is code, not Claude).
      4. Returns summary: how many items were updated.
    """
    task = await db.get(Task, task_id)
    if not task or not owns_or_admin(current_user, task.user_id):
        raise HTTPException(status_code=404, detail="Task not found")

    # 1. Load target items
    q = (
        select(EstimateItem)
        .where(EstimateItem.task_id == task_id)
        .order_by(EstimateItem.sort_order, EstimateItem.position)
    )
    all_items = (await db.execute(q)).scalars().all()
    all_items = [i for i in all_items if i.row_type != "section_header"]

    if body.item_ids:
        id_set = set(body.item_ids)
        target_items = [i for i in all_items if i.id in id_set]
    else:
        # Only items with zero price
        target_items = [i for i in all_items if i.work_price == 0 and i.mat_price == 0]

    if not target_items:
        return {"updated": 0, "message": "Нет позиций для заполнения цен."}

    # Limit to 80 items per call to stay within token budget
    MAX_ITEMS = 80
    target_items = target_items[:MAX_ITEMS]

    # 2. Build prompt for Claude
    region_hint = f"\nРегион / условия: {body.prompt}" if body.prompt else ""
    items_json = json.dumps(
        [{"id": i.id, "name": i.name, "type": i.type, "unit": i.unit, "quantity": i.quantity}
         for i in target_items],
        ensure_ascii=False,
        indent=2,
    )
    user_message = (
        f"Проставь цены для следующих позиций сметы.{region_hint}\n\n"
        f"Позиции:\n{items_json}\n\n"
        "Верни JSON строго в формате:\n"
        '{"items": [{"id": "...", "work_price": 0.0, "mat_price": 0.0, '
        '"source": "...", "comment": "..."}]}\n'
        "Правила: work_price — цена работ за единицу, mat_price — цена материала за единицу. "
        "Для позиций типа 'work' заполняй work_price. "
        "Для 'material'/'equipment' заполняй mat_price. "
        "Не считай итоги — только цены за единицу."
    )

    # 3. Call Claude
    try:
        raw = await claude_service.complete(
            _PRICE_FILL_SYSTEM,
            [{"role": "user", "content": user_message}],
            model=SONNET,
            max_tokens=8000,
        )
    except Exception as e:
        logger.exception("Claude price fill failed for task %s: %s", task_id, e)
        raise HTTPException(status_code=502, detail=f"Claude API error: {e}")

    # Parse JSON (strip markdown fences if present)
    import re
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    text = text.strip()
    start = text.find("{")
    if start != -1:
        text = text[start:]

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        try:
            from json_repair import repair_json
            data = json.loads(repair_json(text))
        except Exception:
            raise HTTPException(status_code=422, detail="Claude вернул невалидный JSON с ценами")

    price_list = data.get("items", [])
    price_map = {p["id"]: p for p in price_list if isinstance(p, dict) and "id" in p}

    # 4. Apply prices — arithmetic is code, not Claude
    item_map = {i.id: i for i in target_items}
    updated = 0
    for item_id, prices in price_map.items():
        item = item_map.get(item_id)
        if not item:
            continue
        wp = float(prices.get("work_price") or 0)
        mp = float(prices.get("mat_price") or 0)
        if wp == 0 and mp == 0:
            continue
        item.work_price = round(wp, 2)
        item.mat_price  = round(mp, 2)
        item.total      = round((wp + mp) * (item.quantity or 1), 2)
        item.is_estimated = True
        item.source     = str(prices.get("source") or "ai_estimate")[:256]
        if prices.get("comment"):
            item.comment = str(prices["comment"])
        updated += 1

    try:
        await db.commit()
    except Exception as e:
        logger.exception("DB commit failed after price fill for task %s: %s", task_id, e)
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения в БД: {e}")

    suffix = f" (первые {MAX_ITEMS} из {len(all_items)})" if len(all_items) > MAX_ITEMS else ""
    return {
        "updated": updated,
        "total_sent": len(target_items),
        "message": f"Заполнено цен: {updated} из {len(target_items)}{suffix}",
    }
