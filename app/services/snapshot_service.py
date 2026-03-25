# app/services/snapshot_service.py
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.task_version import TaskVersion
from app.models.estimate_item import EstimateItem

class SnapshotService:

    async def save_snapshot(
        self,
        db: AsyncSession,
        task_id: uuid.UUID,
        change_type: str,
        change_description: str | None,
        created_by: str,
    ) -> TaskVersion:
        items = (await db.execute(
            select(EstimateItem).where(EstimateItem.task_id == task_id)
            .order_by(EstimateItem.position)
        )).scalars().all()

        snapshot = {"items": [
            {
                "id": str(item.id),
                "position": item.position,
                "type": item.type,
                "name": item.name,
                "unit": item.unit,
                "quantity": item.quantity,
                "work_price": item.work_price,
                "mat_price": item.mat_price,
                "section": item.section,
                "notes": item.notes,
                "is_analogue": item.is_analogue,
                "original_item_id": str(item.original_item_id) if item.original_item_id else None,
                "analogue_note": item.analogue_note,
                "extra": item.extra,
            }
            for item in items
        ]}

        result = await db.execute(
            select(TaskVersion.version_number)
            .where(TaskVersion.task_id == task_id)
            .order_by(TaskVersion.version_number.desc())
            .limit(1)
        )
        last = result.scalar_one_or_none()
        next_number = (last or 0) + 1

        version = TaskVersion(
            task_id=task_id,
            version_number=next_number,
            snapshot=snapshot,
            change_description=change_description,
            change_type=change_type,
            created_by=created_by,
        )
        db.add(version)
        await db.commit()
        await db.refresh(version)
        return version

    async def restore_snapshot(
        self,
        db: AsyncSession,
        task_id: uuid.UUID,
        version_id: uuid.UUID,
    ):
        version = await db.get(TaskVersion, version_id)
        if not version or version.task_id != task_id:
            raise ValueError("Version not found")

        await self.save_snapshot(db, task_id, "restoration", f"Перед восстановлением v{version.version_number}", "system")

        await db.execute(delete(EstimateItem).where(EstimateItem.task_id == task_id))

        for item_data in version.snapshot["items"]:
            item = EstimateItem(
                id=uuid.UUID(item_data["id"]),
                task_id=task_id,
                position=item_data["position"],
                type=item_data["type"],
                name=item_data["name"],
                unit=item_data["unit"],
                quantity=item_data["quantity"],
                work_price=item_data["work_price"],
                mat_price=item_data["mat_price"],
                section=item_data.get("section"),
                notes=item_data.get("notes"),
                is_analogue=item_data.get("is_analogue", False),
                original_item_id=uuid.UUID(item_data["original_item_id"]) if item_data.get("original_item_id") else None,
                analogue_note=item_data.get("analogue_note"),
                extra=item_data.get("extra"),
            )
            db.add(item)

        await db.commit()

snapshot_service = SnapshotService()
