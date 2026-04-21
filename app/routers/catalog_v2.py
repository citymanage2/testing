"""CRUD для каталога работ и материалов (CatalogItem + CatalogPrice)."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.catalog_item import CatalogItem, CatalogPrice, ITEM_TYPES
from app.models.price_source import PriceSource
from app.schemas.estimate_v2 import (
    CatalogItemCreate, CatalogItemUpdate, CatalogItemResponse,
    CatalogPriceCreate, CatalogPriceResponse,
)

router = APIRouter()


# ─── CatalogItem ──────────────────────────────────────────────────────────────

@router.post("", response_model=CatalogItemResponse, status_code=201)
async def create_catalog_item(
    body: CatalogItemCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if body.item_type not in ITEM_TYPES:
        raise HTTPException(status_code=400, detail=f"item_type должен быть одним из: {ITEM_TYPES}")
    now = datetime.now(timezone.utc)
    item = CatalogItem(
        id=str(uuid.uuid4()),
        company_id=body.company_id,
        item_type=body.item_type,
        code=body.code,
        name=body.name,
        unit=body.unit,
        description=body.description,
        category=body.category,
        subcategory=body.subcategory,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("", response_model=list[CatalogItemResponse])
async def list_catalog_items(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    item_type: str = Query(None),
    search: str = Query(None),
    category: str = Query(None),
    active_only: bool = Query(True),
):
    q = select(CatalogItem)
    if active_only:
        q = q.where(CatalogItem.is_active.is_(True))
    if item_type:
        q = q.where(CatalogItem.item_type == item_type)
    if category:
        q = q.where(CatalogItem.category == category)
    if search:
        q = q.where(
            or_(
                CatalogItem.name.ilike(f"%{search}%"),
                CatalogItem.code.ilike(f"%{search}%"),
            )
        )
    q = q.order_by(CatalogItem.name)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{item_id}", response_model=CatalogItemResponse)
async def get_catalog_item(
    item_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(CatalogItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Позиция каталога не найдена")
    return item


@router.patch("/{item_id}", response_model=CatalogItemResponse)
async def update_catalog_item(
    item_id: str,
    body: CatalogItemUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(CatalogItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Позиция каталога не найдена")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    item.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_catalog_item(
    item_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(CatalogItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Позиция каталога не найдена")
    await db.delete(item)
    await db.commit()


# ─── CatalogPrice ─────────────────────────────────────────────────────────────

@router.post("/{item_id}/prices", response_model=CatalogPriceResponse, status_code=201)
async def add_catalog_price(
    item_id: str,
    body: CatalogPriceCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if not await db.get(CatalogItem, item_id):
        raise HTTPException(status_code=404, detail="Позиция каталога не найдена")
    if not await db.get(PriceSource, body.price_source_id):
        raise HTTPException(status_code=404, detail="Источник цен не найден")
    price = CatalogPrice(
        id=str(uuid.uuid4()),
        catalog_item_id=item_id,
        price_source_id=body.price_source_id,
        work_price=body.work_price,
        material_price=body.material_price,
        effective_date=body.effective_date,
        created_at=datetime.now(timezone.utc),
    )
    db.add(price)
    await db.commit()
    await db.refresh(price)
    return price


@router.get("/{item_id}/prices", response_model=list[CatalogPriceResponse])
async def list_catalog_prices(
    item_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CatalogPrice)
        .where(CatalogPrice.catalog_item_id == item_id)
        .order_by(CatalogPrice.effective_date.desc())
    )
    return result.scalars().all()
