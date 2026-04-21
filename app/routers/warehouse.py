"""Склад v2: warehouses, stock, movements."""
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.warehouse import Warehouse, WarehouseStock, StockMovement
from app.schemas.phase4 import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    StockItemResponse, StockMovementCreate, StockMovementResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MOVEMENT_TYPES = ("receipt", "issue", "transfer", "write_off")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_warehouse_or_404(db: AsyncSession, warehouse_id: str) -> Warehouse:
    wh = await db.get(Warehouse, warehouse_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Склад не найден")
    return wh


# ─────────────────────── Warehouses CRUD ───────────────────────

@router.get("", response_model=list[WarehouseResponse])
async def list_warehouses(
    current_user: CurrentUser,
    project_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Warehouse).where(Warehouse.is_active == True)
    if project_id:
        q = q.where(Warehouse.project_id == project_id)
    rows = (await db.execute(q.order_by(Warehouse.name))).scalars().all()
    return rows


@router.post("", response_model=WarehouseResponse, status_code=201)
async def create_warehouse(
    current_user: CurrentUser,
    body: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
):
    wh = Warehouse(
        id=str(uuid.uuid4()),
        created_at=_now(),
        **body.model_dump(),
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return wh


@router.get("/{warehouse_id}", response_model=WarehouseResponse)
async def get_warehouse(
    current_user: CurrentUser,
    warehouse_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await _get_warehouse_or_404(db, warehouse_id)


@router.patch("/{warehouse_id}", response_model=WarehouseResponse)
async def update_warehouse(
    current_user: CurrentUser,
    warehouse_id: str,
    body: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
):
    wh = await _get_warehouse_or_404(db, warehouse_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(wh, field, value)
    await db.commit()
    await db.refresh(wh)
    return wh


@router.delete("/{warehouse_id}", status_code=204)
async def delete_warehouse(
    current_user: CurrentUser,
    warehouse_id: str,
    db: AsyncSession = Depends(get_db),
):
    wh = await _get_warehouse_or_404(db, warehouse_id)
    wh.is_active = False  # мягкое удаление
    await db.commit()


# ─────────────────────── Stock (остатки) ───────────────────────

@router.get("/{warehouse_id}/stock", response_model=list[StockItemResponse])
async def get_stock(
    current_user: CurrentUser,
    warehouse_id: str,
    db: AsyncSession = Depends(get_db),
):
    await _get_warehouse_or_404(db, warehouse_id)
    rows = (await db.execute(
        select(WarehouseStock)
        .where(WarehouseStock.warehouse_id == warehouse_id)
        .order_by(WarehouseStock.updated_at.desc())
    )).scalars().all()

    result = []
    for row in rows:
        available = (row.quantity or Decimal("0")) - (row.reserved_quantity or Decimal("0"))
        result.append(StockItemResponse(
            id=row.id,
            warehouse_id=row.warehouse_id,
            catalog_item_id=row.catalog_item_id,
            quantity=row.quantity,
            reserved_quantity=row.reserved_quantity,
            available=available,
            unit=row.unit,
            updated_at=row.updated_at,
        ))
    return result


# ─────────────────────── Movements ───────────────────────

@router.get("/{warehouse_id}/movements", response_model=list[StockMovementResponse])
async def list_movements(
    current_user: CurrentUser,
    warehouse_id: str,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    await _get_warehouse_or_404(db, warehouse_id)
    rows = (await db.execute(
        select(StockMovement)
        .where(StockMovement.warehouse_id == warehouse_id)
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
    )).scalars().all()
    return rows


@router.post("/{warehouse_id}/movements", response_model=StockMovementResponse, status_code=201)
async def create_movement(
    current_user: CurrentUser,
    warehouse_id: str,
    body: StockMovementCreate,
    db: AsyncSession = Depends(get_db),
):
    """Регистрирует движение и автоматически обновляет остатки."""
    if body.movement_type not in MOVEMENT_TYPES:
        raise HTTPException(status_code=422, detail=f"movement_type должен быть одним из: {MOVEMENT_TYPES}")

    await _get_warehouse_or_404(db, warehouse_id)

    # Создаём запись движения
    movement = StockMovement(
        id=str(uuid.uuid4()),
        warehouse_id=warehouse_id,
        catalog_item_id=body.catalog_item_id,
        quantity=body.quantity,
        movement_type=body.movement_type,
        from_warehouse_id=body.from_warehouse_id,
        reference_type=body.reference_type,
        reference_id=body.reference_id,
        notes=body.notes,
        created_by=current_user.id,
        created_at=_now(),
    )
    db.add(movement)

    # Обновляем остатки на целевом складе
    await _upsert_stock(db, warehouse_id, body.catalog_item_id, body.quantity, body.movement_type)

    # Для transfer: списываем с исходного склада
    if body.movement_type == "transfer" and body.from_warehouse_id:
        await _upsert_stock(db, body.from_warehouse_id, body.catalog_item_id, body.quantity, "issue")

    await db.commit()
    await db.refresh(movement)
    return movement


async def _upsert_stock(
    db: AsyncSession,
    warehouse_id: str,
    catalog_item_id: str,
    quantity: Decimal,
    movement_type: str,
) -> None:
    """Обновляет или создаёт запись остатков склада."""
    stock = (await db.execute(
        select(WarehouseStock)
        .where(
            WarehouseStock.warehouse_id == warehouse_id,
            WarehouseStock.catalog_item_id == catalog_item_id,
        )
    )).scalar_one_or_none()

    if stock is None:
        stock = WarehouseStock(
            id=str(uuid.uuid4()),
            warehouse_id=warehouse_id,
            catalog_item_id=catalog_item_id,
            quantity=Decimal("0"),
            reserved_quantity=Decimal("0"),
            unit="шт",
            updated_at=_now(),
        )
        db.add(stock)

    if movement_type == "receipt":
        stock.quantity = (stock.quantity or Decimal("0")) + quantity
    elif movement_type in ("issue", "write_off"):
        current = stock.quantity or Decimal("0")
        if quantity > current:
            logger.warning(
                "_upsert_stock: списание %s превышает остаток %s для catalog_item_id=%s на складе %s. Остаток обнуляется.",
                quantity, current, stock.catalog_item_id, warehouse_id,
            )
        stock.quantity = max(Decimal("0"), current - quantity)
    elif movement_type == "transfer":
        # При transfer на целевой склад — приход
        stock.quantity = (stock.quantity or Decimal("0")) + quantity

    stock.updated_at = _now()
