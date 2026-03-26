"""Find and apply analogues for estimate items via Claude AI."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.estimate_item import EstimateItem
from app.services import claude_service
from app.services.snapshot_service import snapshot_service
from app.config import settings


class AnalogueService:
    async def find_analogues(self, db: AsyncSession, task_id: str, item_id: str) -> list:
        item = await db.get(EstimateItem, item_id)
        if not item:
            return []

        system = (
            f"Ты эксперт по строительным материалам и работам в России, регион: {settings.search_city}. "
            "Ты хорошо знаешь российских поставщиков: Леруа Мерлен, Петрович, OBI, Максидом, СтройДепо, ВсеИнструменты. "
            "Давай конкретные, реально существующие аналоги с реальными ценами на 2024-2025 год."
        )
        item_type = item.type
        current_price = item.mat_price if item_type == "Материал" else item.work_price
        prompt = f"""Позиция сметы:
Тип: {item_type}
Наименование: {item.name}
Единица: {item.unit}
Текущая цена: {current_price:.2f} руб/{item.unit}
Раздел: {item.section}

Найди 3 реальных аналога дешевле. Для каждого укажи:
- Конкретное наименование с маркой/артикулом
- Поставщика (реальный российский)
- Реальную цену за {item.unit}
- Ссылку на сайт поставщика (если знаешь точную — укажи, иначе главную страницу поставщика)
- Процент экономии

Верни строго JSON массив (без пояснений):
[
  {{
    "id": "1",
    "name": "Конкретное название материала/работы",
    "price": 0.0,
    "unit": "{item.unit}",
    "supplier": "Название поставщика",
    "economy_pct": 0,
    "source_url": "https://..."
  }}
]"""
        try:
            result = await claude_service.complete_json(system, [{"role": "user", "content": prompt}])
            items = result if isinstance(result, list) else result.get("items", [])
            # Filter out items not cheaper
            return [i for i in items if float(i.get("price", 999999)) < current_price * 1.05] or items
        except Exception:
            return []

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
