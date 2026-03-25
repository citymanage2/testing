# app/services/analogue_service.py
import uuid, json, re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.estimate_item import EstimateItem
from app.services.snapshot_service import snapshot_service
from app.services.claude_service import claude_service
from app.config import settings

class AnalogueService:

    async def find_analogues(
        self, db: AsyncSession, task_id: uuid.UUID, item_id: uuid.UUID
    ) -> list[dict]:
        item = await db.get(EstimateItem, item_id)
        if not item:
            raise ValueError("Item not found")

        # Проверить кэш
        if item.extra and item.extra.get("analogues_cache"):
            return item.extra["analogues_cache"]

        prompt = f"""
Найди 3 аналога для: "{item.name}", ед.изм.: {item.unit}, город: {settings.search_city}.
Текущая цена: {item.mat_price or item.work_price} руб.

Ответь ТОЛЬКО валидным JSON:
{{
  "analogues": [
    {{
      "name": "название аналога",
      "price": число,
      "unit": "ед.изм.",
      "supplier": "поставщик",
      "economy_pct": число,
      "source_url": "url или null"
    }}
  ]
}}
"""
        response = await claude_service.complete(
            messages=[{"role": "user", "content": prompt}],
            task_type="SMETA_FROM_TZ",
            use_web_search=True,
        )
        clean = re.sub(r"```(?:json)?\s*", "", response).strip().rstrip("`")
        data = json.loads(clean)
        analogues = data.get("analogues", [])

        # Кэшировать в extra
        item.extra = {**(item.extra or {}), "analogues_cache": analogues}
        await db.commit()
        return analogues

    async def apply_analogue(
        self,
        db: AsyncSession,
        task_id: uuid.UUID,
        item_id: uuid.UUID,
        analogue_data: dict,
    ):
        await snapshot_service.save_snapshot(
            db, task_id, "manual_edit", f"Применён аналог: {analogue_data.get('name')}", "user"
        )

        original = await db.get(EstimateItem, item_id)
        if not original:
            raise ValueError("Item not found")

        # Получить max position
        result = await db.execute(
            select(EstimateItem.position)
            .where(EstimateItem.task_id == task_id)
            .order_by(EstimateItem.position.desc()).limit(1)
        )
        max_pos = result.scalar_one_or_none() or 0

        new_item = EstimateItem(
            task_id=task_id,
            position=original.position,  # Вставить на место оригинала
            type=original.type,
            name=analogue_data["name"],
            unit=analogue_data.get("unit", original.unit),
            quantity=original.quantity,
            work_price=analogue_data["price"] if original.type == "Работа" else 0.0,
            mat_price=analogue_data["price"] if original.type == "Материал" else 0.0,
            section=original.section,
            is_analogue=True,
            original_item_id=original.id,
            analogue_note=f"Аналог от {analogue_data.get('supplier', '')}. {analogue_data.get('source_url', '')}",
        )
        db.add(new_item)
        # Скрыть оригинал: сдвинуть его в конец
        original.position = max_pos + 1
        await db.commit()

    async def revert_analogue(
        self,
        db: AsyncSession,
        task_id: uuid.UUID,
        item_id: uuid.UUID,
    ):
        item = await db.get(EstimateItem, item_id)
        if not item or not item.is_analogue:
            raise ValueError("Not an analogue item")

        await snapshot_service.save_snapshot(
            db, task_id, "manual_edit", "Отмена аналога", "user"
        )

        original_id = item.original_item_id
        db.delete(item)

        # Вернуть оригинал на его позицию
        if original_id:
            original = await db.get(EstimateItem, original_id)
            if original:
                # Найти позицию аналога и восстановить
                original.position = item.position

        await db.commit()

analogue_service = AnalogueService()
