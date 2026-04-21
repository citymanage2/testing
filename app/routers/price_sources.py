"""CRUD для источников цен (PriceSource)."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.price_source import PriceSource, SOURCE_TYPES
from app.schemas.estimate_v2 import PriceSourceCreate, PriceSourceResponse

router = APIRouter()


@router.post("", response_model=PriceSourceResponse, status_code=201)
async def create_price_source(
    body: PriceSourceCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if body.source_type not in SOURCE_TYPES:
        raise HTTPException(status_code=400, detail=f"source_type должен быть одним из: {SOURCE_TYPES}")
    src = PriceSource(
        id=str(uuid.uuid4()),
        company_id=body.company_id,
        name=body.name,
        source_type=body.source_type,
        url=body.url,
        reference_date=body.reference_date,
        created_at=datetime.now(timezone.utc),
    )
    db.add(src)
    await db.commit()
    await db.refresh(src)
    return src


@router.get("", response_model=list[PriceSourceResponse])
async def list_price_sources(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PriceSource).order_by(PriceSource.name))
    return result.scalars().all()


@router.get("/{source_id}", response_model=PriceSourceResponse)
async def get_price_source(
    source_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    src = await db.get(PriceSource, source_id)
    if not src:
        raise HTTPException(status_code=404, detail="Источник цен не найден")
    return src


@router.delete("/{source_id}", status_code=204)
async def delete_price_source(
    source_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    src = await db.get(PriceSource, source_id)
    if not src:
        raise HTTPException(status_code=404, detail="Источник цен не найден")
    await db.delete(src)
    await db.commit()
