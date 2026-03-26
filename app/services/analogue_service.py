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

        system = f"Ты эксперт по строительным материалам в регионе {settings.search_city}."
        prompt = f"""Найди 3 аналога для: {item.name}, ед: {item.unit}, текущая цена: {item.mat_price or item.work_price} руб.
Верни JSON массив:
[
  {{
    "id": "1",
    "name": "...",
    "price": 0,
    "unit": "...",
    "supplier": "...",
    "economy_pct": 0,
    "source_url": null
  }}
]"""
        try:
            result = await claude_service.complete_json(system, [{"role": "user", "content": prompt}])
            return result if isinstance(result, list) else result.get("items", [])
        except Exception:
            return []

    async def apply_analogue(self, db: AsyncSession, task_id: str, item_id: str, analogue: dict):
        item = await db.get(EstimateItem, item_id)
        if not item:
            return

        await snapshot_service.save_snapshot(db, task_id, "analogue", f"Применён аналог для {item.name}")

        # Save original
        item.original_data = {
            "name": item.name, "work_price": item.work_price,
            "mat_price": item.mat_price, "total": item.total,
        }

        price = float(analogue.get("price", 0))
        if item.type == "Работа":
            item.work_price = price
        else:
            item.mat_price = price
        item.total = (item.work_price + item.mat_price) * item.quantity
        item.is_analogue = True
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
        item.is_analogue = False
        item.original_data = None
        await db.commit()


analogue_service = AnalogueService()
