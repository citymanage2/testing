from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.price_catalog import PriceCatalog
from app.models.estimate_item import EstimateItem

router = APIRouter()


class CatalogEntryIn(BaseModel):
    item_type: str = "work"  # work|material
    name: str
    unit: Optional[str] = None
    work_price: float = 0.0
    mat_price: float = 0.0
    tags: Optional[list] = None


class CatalogEntryOut(BaseModel):
    id: str
    item_type: str
    name: str
    unit: Optional[str]
    work_price: float
    mat_price: float
    tags: Optional[list]
    created_at: datetime


def _out(r: PriceCatalog) -> CatalogEntryOut:
    return CatalogEntryOut(
        id=r.id, item_type=r.item_type, name=r.name, unit=r.unit,
        work_price=r.work_price, mat_price=r.mat_price,
        tags=r.tags or [], created_at=r.created_at,
    )


@router.get("", response_model=list[CatalogEntryOut])
async def list_catalog(
    q: Optional[str] = None,
    item_type: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PriceCatalog).where(PriceCatalog.user_id == current_user.id)
    if item_type:
        query = query.where(PriceCatalog.item_type == item_type)
    if q:
        query = query.where(PriceCatalog.name.ilike(f"%{q}%"))
    query = query.order_by(PriceCatalog.name).limit(limit)
    rows = (await db.execute(query)).scalars().all()
    return [_out(r) for r in rows]


@router.post("", response_model=CatalogEntryOut)
async def create_catalog_entry(
    body: CatalogEntryIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = PriceCatalog(
        id=str(uuid.uuid4()), user_id=current_user.id,
        item_type=body.item_type, name=body.name, unit=body.unit,
        work_price=body.work_price, mat_price=body.mat_price, tags=body.tags or [],
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _out(row)


@router.post("/from-estimate-item/{item_id}", response_model=CatalogEntryOut)
async def save_estimate_item_to_catalog(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(EstimateItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    row = PriceCatalog(
        id=str(uuid.uuid4()), user_id=current_user.id,
        item_type="material" if item.type == "Материал" else "work",
        name=item.name, unit=item.unit,
        work_price=item.work_price, mat_price=item.mat_price, tags=[],
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _out(row)


@router.put("/{entry_id}", response_model=CatalogEntryOut)
async def update_catalog_entry(
    entry_id: str,
    body: CatalogEntryIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(PriceCatalog, entry_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    row.item_type = body.item_type
    row.name = body.name
    row.unit = body.unit
    row.work_price = body.work_price
    row.mat_price = body.mat_price
    row.tags = body.tags or []
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return _out(row)


@router.delete("/{entry_id}")
async def delete_catalog_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(PriceCatalog, entry_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
