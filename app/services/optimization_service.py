"""Estimate cost optimization via Claude AI."""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.estimate_item import EstimateItem
from app.services import claude_service
from app.services.snapshot_service import snapshot_service


class OptimizationService:
    async def get_optimization_plan(self, db: AsyncSession, task_id: str) -> dict:
        items = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.total.desc()).limit(20))).scalars().all()
        if not items:
            return {"items": [], "total_savings": 0}

        items_text = "\n".join(
            f"- id={i.id} name={i.name!r} unit={i.unit} qty={i.quantity} work={i.work_price} mat={i.mat_price} total={i.total}"
            for i in items
        )
        system = "Ты эксперт по оптимизации строительных смет."
        prompt = f"""По следующим позициям сметы предложи план оптимизации.
{items_text}

Верни JSON:
{{
  "items": [
    {{
      "id": "...",
      "name": "...",
      "current_price": 0,
      "optimized_price": 0,
      "savings": 0,
      "description": "обоснование"
    }}
  ],
  "total_savings": 0
}}"""
        result = await claude_service.complete_json(system, [{"role": "user", "content": prompt}])
        return result if isinstance(result, dict) else {"items": result, "total_savings": 0}

    async def execute_optimization(self, db: AsyncSession, task_id: str, item_ids: list[str]):
        await snapshot_service.save_snapshot(db, task_id, "optimization", "Оптимизация стоимости")

        for item_id in item_ids:
            item = await db.get(EstimateItem, item_id)
            if not item:
                continue
            system = "Ты эксперт-сметчик. Найди более дешёвый аналог для позиции."
            prompt = f"""Позиция: {item.name}, ед: {item.unit}, цена работ: {item.work_price}, цена материала: {item.mat_price}.
Верни JSON: {{"work_price": 0, "mat_price": 0, "name": "новое название или то же"}}"""
            try:
                result = await claude_service.complete_json(system, [{"role": "user", "content": prompt}])
                item.work_price = float(result.get("work_price", item.work_price))
                item.mat_price = float(result.get("mat_price", item.mat_price))
                item.total = (item.work_price + item.mat_price) * item.quantity
            except Exception:
                pass

        await db.commit()


optimization_service = OptimizationService()
