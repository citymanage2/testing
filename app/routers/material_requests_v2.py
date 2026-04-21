"""Заявки на материалы v2."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.material_request import MaterialRequest, MaterialRequestItem, REQUEST_STATUSES
from app.models.warehouse import WarehouseStock
from app.schemas.phase4 import (
    MaterialRequestCreate, MaterialRequestUpdate, MaterialRequestResponse,
    MaterialRequestWithItems,
    RequestItemCreate, RequestItemUpdate, RequestItemResponse,
)

router = APIRouter()

# Допустимые переходы статусов
_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "draft":     ["submitted", "cancelled"],
    "submitted": ["approved", "cancelled", "draft"],
    "approved":  ["ordered", "cancelled"],
    "ordered":   ["delivered", "cancelled"],
    "delivered": [],
    "cancelled": ["draft"],
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _adjust_reserved(
    db: AsyncSession,
    req: MaterialRequest,
    delta: Decimal,  # +N = резервировать, -N = снять резерв
) -> None:
    """Изменяет reserved_quantity на складе для всех позиций заявки с catalog_item_id."""
    if not req.warehouse_id:
        return
    items = (await db.execute(
        select(MaterialRequestItem)
        .where(MaterialRequestItem.request_id == req.id)
        .where(MaterialRequestItem.catalog_item_id.is_not(None))
    )).scalars().all()
    for item in items:
        stock = (await db.execute(
            select(WarehouseStock).where(
                WarehouseStock.warehouse_id == req.warehouse_id,
                WarehouseStock.catalog_item_id == item.catalog_item_id,
            )
        )).scalar_one_or_none()
        if stock:
            qty = item.quantity_planned or Decimal("0")
            stock.reserved_quantity = max(
                Decimal("0"),
                (stock.reserved_quantity or Decimal("0")) + delta * qty,
            )
            stock.updated_at = _now()


async def _apply_delivery(db: AsyncSession, req: MaterialRequest) -> None:
    """При доставке: снимаем резерв и списываем фактически поставленное количество."""
    if not req.warehouse_id:
        return
    items = (await db.execute(
        select(MaterialRequestItem)
        .where(MaterialRequestItem.request_id == req.id)
        .where(MaterialRequestItem.catalog_item_id.is_not(None))
    )).scalars().all()
    for item in items:
        actual = item.quantity_actual or Decimal("0")
        planned = item.quantity_planned or Decimal("0")
        stock = (await db.execute(
            select(WarehouseStock).where(
                WarehouseStock.warehouse_id == req.warehouse_id,
                WarehouseStock.catalog_item_id == item.catalog_item_id,
            )
        )).scalar_one_or_none()
        if stock:
            # Снимаем резерв (был поставлен planned)
            stock.reserved_quantity = max(Decimal("0"), (stock.reserved_quantity or Decimal("0")) - planned)
            # Добавляем фактически поставленное
            stock.quantity = (stock.quantity or Decimal("0")) + actual
            stock.updated_at = _now()


async def _get_request_or_404(db: AsyncSession, request_id: str) -> MaterialRequest:
    req = await db.get(MaterialRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return req


async def _get_item_or_404(db: AsyncSession, item_id: str) -> MaterialRequestItem:
    item = await db.get(MaterialRequestItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Позиция заявки не найдена")
    return item


# ─────────────────────── Requests CRUD ───────────────────────

@router.get("", response_model=list[MaterialRequestResponse])
async def list_requests(
    project_id: str = Query(...),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    q = select(MaterialRequest).where(MaterialRequest.project_id == project_id)
    if status:
        q = q.where(MaterialRequest.status == status)
    rows = (await db.execute(q.order_by(MaterialRequest.created_at.desc()))).scalars().all()
    return rows


@router.post("", response_model=MaterialRequestResponse, status_code=201)
async def create_request(
    body: MaterialRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    req = MaterialRequest(
        id=str(uuid.uuid4()),
        project_id=body.project_id,
        title=body.title,
        stage_id=body.stage_id,
        warehouse_id=body.warehouse_id,
        notes=body.notes,
        status="draft",
        requested_by=current_user.id,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


@router.get("/{request_id}", response_model=MaterialRequestWithItems)
async def get_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    req = await _get_request_or_404(db, request_id)
    items = (await db.execute(
        select(MaterialRequestItem).where(MaterialRequestItem.request_id == request_id)
    )).scalars().all()
    return MaterialRequestWithItems(
        **MaterialRequestResponse.model_validate(req).model_dump(),
        items=[RequestItemResponse.model_validate(i) for i in items],
    )


@router.patch("/{request_id}", response_model=MaterialRequestResponse)
async def update_request(
    request_id: str,
    body: MaterialRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    req = await _get_request_or_404(db, request_id)
    data = body.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(req, field, value)
    req.updated_at = _now()
    await db.commit()
    await db.refresh(req)
    return req


@router.delete("/{request_id}", status_code=204)
async def delete_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    req = await _get_request_or_404(db, request_id)
    if req.status not in ("draft", "cancelled"):
        raise HTTPException(status_code=403, detail="Можно удалять только черновики и отменённые заявки")
    await db.delete(req)
    await db.commit()


# ─────────────────────── Status transition ───────────────────────

@router.post("/{request_id}/transition", response_model=MaterialRequestResponse)
async def transition_status(
    request_id: str,
    new_status: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Явный переход статуса заявки с управлением reserved_quantity на складе.

    approved  → резервируем quantity_planned на складе
    cancelled (из approved/ordered) → снимаем резерв
    delivered → снимаем резерв + зачисляем quantity_actual на остатки
    """
    req = await _get_request_or_404(db, request_id)
    old_status = req.status
    allowed = _STATUS_TRANSITIONS.get(old_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Переход из '{old_status}' в '{new_status}' не разрешён. Допустимые: {allowed}",
        )

    req.status = new_status
    req.updated_at = _now()

    # Управляем резервами на складе
    if new_status == "approved":
        await _adjust_reserved(db, req, Decimal("1"))
    elif new_status == "cancelled" and old_status in ("approved", "ordered"):
        await _adjust_reserved(db, req, Decimal("-1"))
    elif new_status == "delivered":
        await _apply_delivery(db, req)

    await db.commit()
    await db.refresh(req)
    return req


# ─────────────────────── Items CRUD ───────────────────────

@router.get("/{request_id}/items", response_model=list[RequestItemResponse])
async def list_items(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await _get_request_or_404(db, request_id)
    rows = (await db.execute(
        select(MaterialRequestItem).where(MaterialRequestItem.request_id == request_id)
    )).scalars().all()
    return rows


@router.post("/{request_id}/items", response_model=RequestItemResponse, status_code=201)
async def add_item(
    request_id: str,
    body: RequestItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    req = await _get_request_or_404(db, request_id)
    if req.status not in ("draft",):
        raise HTTPException(status_code=403, detail="Добавлять позиции можно только в черновик")

    item = MaterialRequestItem(
        id=str(uuid.uuid4()),
        request_id=request_id,
        name=body.name,
        unit=body.unit,
        quantity_planned=body.quantity_planned,
        catalog_item_id=body.catalog_item_id,
        estimate_position_id=body.estimate_position_id,
        notes=body.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{request_id}/items/{item_id}", response_model=RequestItemResponse)
async def update_item(
    request_id: str,
    item_id: str,
    body: RequestItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    req = await _get_request_or_404(db, request_id)
    item = await _get_item_or_404(db, item_id)
    if item.request_id != request_id:
        raise HTTPException(status_code=404, detail="Позиция не принадлежит этой заявке")

    data = body.model_dump(exclude_unset=True)
    if "quantity_planned" in data and req.status in ("approved", "ordered"):
        raise HTTPException(
            status_code=422,
            detail="Нельзя изменить quantity_planned: заявка уже одобрена/в заказе. Снимите одобрение сначала.",
        )

    for field, value in data.items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{request_id}/items/{item_id}", status_code=204)
async def delete_item(
    request_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await _get_request_or_404(db, request_id)
    item = await _get_item_or_404(db, item_id)
    if item.request_id != request_id:
        raise HTTPException(status_code=404, detail="Позиция не принадлежит этой заявке")
    await db.delete(item)
    await db.commit()
