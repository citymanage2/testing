"""Find and apply analogues for estimate items via Claude AI with web search."""
import json
from json_repair import repair_json
from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.estimate_item import EstimateItem
from app.services.snapshot_service import snapshot_service
from app.config import settings

_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
MODEL = "claude-opus-4-6"


async def _find_with_web_search(item_name: str, item_type: str, unit: str,
                                current_price: float, section: str) -> list:
    """Use Claude with web_search to find real analogues with 2026 prices."""
    prompt = f"""Найди аналоги для строительного материала/работы для закупки в России в 2026 году.

Позиция: {item_name}
Тип: {item_type}
Единица: {unit}
Текущая цена: {current_price:.2f} руб/{unit}
Раздел сметы: {section}

Задача:
1. Найди 3-4 аналога в интернете (поиск по российским магазинам и поставщикам)
2. Для каждого аналога определи:
   - Совпадение характеристик ≥90%
   - Реальная цена на 2026 год (актуальная)
   - Возможность купить в РФ прямо сейчас
   - Реальная ссылка на страницу товара
   - В чём отличие от оригинала (характеристики лучше/хуже/равны)
3. Также найди тот же материал/работу, но дешевле у других поставщиков

Верни JSON массив:
[
  {{
    "id": "1",
    "name": "Точное наименование с маркой/артикулом",
    "price": 0.0,
    "unit": "{unit}",
    "supplier": "Название поставщика",
    "economy_pct": 0,
    "source_url": "https://реальная-ссылка.ru/товар",
    "diff": "Отличия от оригинала: в чём лучше/хуже",
    "match_pct": 95
  }}
]
Важно: только реальные товары с реальными ценами 2026 года, доступные в РФ."""

    try:
        resp = await _client.messages.create(
            model=MODEL,
            max_tokens=4000,
            tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 5}],
            messages=[{"role": "user", "content": prompt}],
        )

        # Collect text from all content blocks
        text_parts = []
        for block in resp.content:
            if hasattr(block, "text"):
                text_parts.append(block.text)

        text = " ".join(text_parts).strip()
        if not text:
            raise ValueError("No text in response")

        # Extract JSON
        start = text.find("[")
        if start == -1:
            raise ValueError("No JSON array found")
        end = text.rfind("]")
        if end == -1:
            raise ValueError("Unterminated JSON array")
        json_text = text[start:end + 1]
        try:
            items = json.loads(json_text)
        except json.JSONDecodeError:
            items = json.loads(repair_json(json_text))

        return items if isinstance(items, list) else []

    except Exception:
        # Fallback: use plain Claude without web search
        return await _find_without_search(item_name, item_type, unit, current_price, section)


async def _find_without_search(item_name: str, item_type: str, unit: str,
                               current_price: float, section: str) -> list:
    """Fallback: Claude without web search, still focused on 2026 RF market."""
    from app.services import claude_service
    system = (
        f"Ты эксперт по строительным материалам в России, {settings.search_city}. "
        "Знаешь поставщиков: Леруа Мерлен, Петрович, OBI, ВсеИнструменты, Сатурн, БАУMAX, "
        "СтройДепо, Максидом, Строительный двор. Цены актуальны на 2026 год."
    )
    prompt = f"""Позиция сметы:
Тип: {item_type}
Наименование: {item_name}
Единица: {unit}
Текущая цена: {current_price:.2f} руб/{unit}
Раздел: {section}

Найди 3 реальных аналога для закупки в России (2026 год).
Для каждого укажи отличия от оригинала (характеристики лучше/хуже/равны).
Ищи: 1) тот же товар дешевле у другого поставщика, 2) аналоги с совпадением ≥90%.

JSON массив:
[
  {{
    "id": "1",
    "name": "Наименование с маркой/артикулом",
    "price": 0.0,
    "unit": "{unit}",
    "supplier": "Поставщик",
    "economy_pct": 0,
    "source_url": "https://...",
    "diff": "Отличия: в чём лучше/хуже оригинала",
    "match_pct": 90
  }}
]"""
    try:
        result = await claude_service.complete_json(system, [{"role": "user", "content": prompt}])
        return result if isinstance(result, list) else result.get("items", [])
    except Exception:
        return []


class AnalogueService:
    async def find_analogues(self, db: AsyncSession, task_id: str, item_id: str) -> list:
        item = await db.get(EstimateItem, item_id)
        if not item:
            return []

        item_type = item.type
        current_price = item.mat_price if item_type == "Материал" else item.work_price

        analogues = await _find_with_web_search(
            item_name=item.name or "",
            item_type=item_type or "Материал",
            unit=item.unit or "шт",
            current_price=float(current_price or 0),
            section=item.section or "",
        )

        # Ensure required fields have defaults
        for a in analogues:
            a.setdefault("diff", "")
            a.setdefault("match_pct", 90)
            a.setdefault("economy_pct", 0)
            if current_price > 0 and float(a.get("price", 0)) > 0:
                a["economy_pct"] = round(
                    (current_price - float(a["price"])) / current_price * 100, 1
                )

        return analogues

    async def apply_analogue(self, db: AsyncSession, task_id: str, item_id: str, analogue: dict):
        item = await db.get(EstimateItem, item_id)
        if not item:
            return

        await snapshot_service.save_snapshot(db, task_id, "analogue", f"Применён аналог для {item.name}")

        item.original_data = {
            "name": item.name, "work_price": item.work_price,
            "mat_price": item.mat_price, "total": item.total,
            "source_url": item.source_url,
        }

        price = float(analogue.get("price", 0))
        if item.type == "Работа":
            item.work_price = price
        else:
            item.mat_price = price
        item.total = (item.work_price + item.mat_price) * item.quantity
        item.is_analogue = True
        item.source_url = analogue.get("source_url") or item.source_url
        await db.commit()

    async def revert_analogue(self, db: AsyncSession, task_id: str, item_id: str):
        item = await db.get(EstimateItem, item_id)
        if not item or not item.original_data:
            return

        await snapshot_service.save_snapshot(db, task_id, "revert", f"Отмена аналога для {item.name}")

        orig = item.original_data
        item.work_price = orig.get("work_price", item.work_price)
        item.mat_price = orig.get("mat_price", item.mat_price)
        item.total = orig.get("total", item.total)
        item.source_url = orig.get("source_url")
        item.is_analogue = False
        item.original_data = None
        await db.commit()


analogue_service = AnalogueService()
