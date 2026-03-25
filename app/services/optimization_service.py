# app/services/optimization_service.py
import uuid
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.estimate_item import EstimateItem
from app.models.task import Task
from app.services.snapshot_service import snapshot_service
from app.services.claude_service import claude_service

class OptimizationService:

    async def get_optimization_plan(self, db: AsyncSession, task_id: uuid.UUID) -> dict:
        """
        Вернуть топ-10 позиций по стоимости для потенциальной оптимизации.
        """
        items = (await db.execute(
            select(EstimateItem).where(EstimateItem.task_id == task_id)
        )).scalars().all()

        # Вычислить стоимость каждой позиции
        items_with_cost = [
            {
                "id": str(item.id),
                "name": item.name,
                "type": item.type,
                "unit": item.unit,
                "quantity": item.quantity,
                "work_price": item.work_price,
                "mat_price": item.mat_price,
                "total_cost": (item.work_price + item.mat_price) * item.quantity,
            }
            for item in items if not item.is_analogue
        ]
        items_with_cost.sort(key=lambda x: x["total_cost"], reverse=True)
        top10 = items_with_cost[:10]

        total_cost = sum(i["total_cost"] for i in items_with_cost)
        top10_cost = sum(i["total_cost"] for i in top10)

        return {
            "items": top10,
            "total_cost": total_cost,
            "top10_cost": top10_cost,
            "top10_pct": (top10_cost / total_cost * 100) if total_cost else 0,
        }

    async def execute_optimization(
        self,
        db: AsyncSession,
        task_id: uuid.UUID,
        item_ids: list[str],
    ):
        """
        Для каждой позиции из item_ids — запросить у Claude более дешёвый аналог.
        Батчи по 10 позиций.
        """
        # Сохранить snapshot перед изменениями
        await snapshot_service.save_snapshot(
            db, task_id, "optimization", "Перед оптимизацией", "system"
        )

        # Загрузить позиции
        items = (await db.execute(
            select(EstimateItem).where(
                EstimateItem.id.in_([uuid.UUID(i) for i in item_ids]),
                EstimateItem.task_id == task_id,
            )
        )).scalars().all()

        # Батчи по 10
        batch_size = 10
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            await self._optimize_batch(db, batch)

        # Обновить estimate_status
        task = await db.get(Task, task_id)
        if task:
            task.estimate_status = "optimized"
            task.estimate_status_updated_by = "auto"
        await db.commit()

    async def _optimize_batch(self, db: AsyncSession, items: list):
        items_json = json.dumps([
            {"id": str(it.id), "name": it.name, "type": it.type,
             "unit": it.unit, "work_price": it.work_price, "mat_price": it.mat_price}
            for it in items
        ], ensure_ascii=False)

        prompt = f"""
Для каждой позиции найди более дешёвый аналог если возможно.
Позиции: {items_json}

Ответь ТОЛЬКО валидным JSON:
{{
  "results": [
    {{
      "id": "uuid",
      "found": true | false,
      "new_work_price": число или null,
      "new_mat_price": число или null,
      "analogue_note": "обоснование"
    }}
  ]
}}
"""
        try:
            response = await claude_service.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type="SMETA_FROM_TZ",
                use_web_search=True,
            )
            import re
            clean = re.sub(r"```(?:json)?\s*", "", response).strip().rstrip("`")
            data = json.loads(clean)

            for result in data.get("results", []):
                if not result.get("found"):
                    continue
                item = next((it for it in items if str(it.id) == result["id"]), None)
                if not item:
                    continue
                if result.get("new_work_price") and result["new_work_price"] < item.work_price:
                    item.work_price = result["new_work_price"]
                    item.is_analogue = True
                    item.analogue_note = result.get("analogue_note", "")
                if result.get("new_mat_price") and result["new_mat_price"] < item.mat_price:
                    item.mat_price = result["new_mat_price"]
                    item.is_analogue = True
                    item.analogue_note = result.get("analogue_note", "")
        except Exception:
            pass  # Батч не удался — пропустить, не падать

optimization_service = OptimizationService()
