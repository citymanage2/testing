"""Save and restore estimate item snapshots (version history)."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.estimate_item import EstimateItem
from app.models.task_version import TaskVersion


class SnapshotService:
    async def save_snapshot(self, db: AsyncSession, task_id: str, change_type: str, description: str):
        items = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.position))).scalars().all()
        snapshot = [
            {
                "id": i.id, "position": i.position, "section": i.section, "type": i.type,
                "name": i.name, "unit": i.unit, "quantity": i.quantity,
                "work_price": i.work_price, "mat_price": i.mat_price,
                "total": i.total, "is_analogue": i.is_analogue,
            }
            for i in items
        ]
        count = (await db.execute(select(func.count()).where(TaskVersion.task_id == task_id))).scalar_one()
        db.add(TaskVersion(
            id=str(uuid.uuid4()),
            task_id=task_id,
            version_number=count + 1,
            snapshot=snapshot,
            change_type=change_type,
            change_description=description,
            created_at=datetime.now(timezone.utc),
        ))
        await db.flush()

    async def restore_snapshot(self, db: AsyncSession, task_id: str, version_id: str):
        version = await db.get(TaskVersion, version_id)
        if not version:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Version not found")

        await self.save_snapshot(db, task_id, "restore", f"Перед восстановлением версии {version.version_number}")

        existing = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task_id))).scalars().all()
        for item in existing:
            await db.delete(item)

        for raw in version.snapshot:
            db.add(EstimateItem(
                id=str(uuid.uuid4()),
                task_id=task_id,
                position=raw["position"],
                section=raw.get("section", ""),
                type=raw.get("type", ""),
                name=raw["name"],
                unit=raw.get("unit", ""),
                quantity=raw["quantity"],
                work_price=raw.get("work_price", 0),
                mat_price=raw.get("mat_price", 0),
                total=raw.get("total", 0),
                is_analogue=raw.get("is_analogue", False),
            ))
        await db.commit()


snapshot_service = SnapshotService()
