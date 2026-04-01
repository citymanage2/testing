import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel

from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project import Project
from app.models.purchase_request import PurchaseRequest, PurchaseRequestItem
from app.models.estimate_item import EstimateItem
from app.models.task import Task

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PurchaseRequestCreate(BaseModel):
    title: str
    notes: Optional[str] = None


class PurchaseRequestPatch(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PurchaseRequestResponse(BaseModel):
    id: str
    project_id: str
    title: str
    status: str
    notes: Optional[str]
    requested_by: Optional[str]
    items_count: int
    total_amount: float
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PurchaseItemIn(BaseModel):
    estimate_item_id: Optional[str] = None
    name: str
    unit: Optional[str] = None
    quantity_requested: float
    quantity_delivered: Optional[float] = None
    supplier_id: Optional[str] = None
    unit_price: Optional[float] = None
    notes: Optional[str] = None


class PurchaseItemPatch(BaseModel):
    quantity_delivered: Optional[float] = None
    unit_price: Optional[float] = None
    supplier_id: Optional[str] = None
    notes: Optional[str] = None


class PurchaseItemResponse(BaseModel):
    id: str
    request_id: str
    estimate_item_id: Optional[str]
    name: str
    unit: Optional[str]
    quantity_requested: float
    quantity_delivered: Optional[float]
    supplier_id: Optional[str]
    supplier_name: Optional[str]
    unit_price: Optional[float]
    total: float
    notes: Optional[str]

    model_config = {"from_attributes": True}


class MaterialsSummaryItem(BaseModel):
    estimate_item_id: Optional[str]
    name: str
    unit: str
    quantity_in_estimate: float
    quantity_requested: float
    quantity_delivered: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_project_owned(project_id: str, user_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return project


async def _get_supplier_name(supplier_id: Optional[str], db: AsyncSession) -> Optional[str]:
    if not supplier_id:
        return None
    try:
        from app.models.contractor import Contractor
        supplier = await db.get(Contractor, supplier_id)
        return getattr(supplier, "name", None) if supplier else None
    except Exception:
        return None


async def _enrich_request(req: PurchaseRequest, db: AsyncSession) -> PurchaseRequestResponse:
    items_result = await db.execute(
        select(PurchaseRequestItem).where(PurchaseRequestItem.request_id == req.id)
    )
    items = items_result.scalars().all()
    items_count = len(items)
    total_amount = sum(
        (getattr(i, "quantity_requested", 0.0) * (getattr(i, "unit_price", None) or 0.0))
        for i in items
    )
    return PurchaseRequestResponse(
        id=req.id,
        project_id=req.project_id,
        title=req.title,
        status=req.status,
        notes=getattr(req, "notes", None),
        requested_by=getattr(req, "requested_by", None),
        items_count=items_count,
        total_amount=total_amount,
        created_at=getattr(req, "created_at", None),
    )


def _item_response(item: PurchaseRequestItem, supplier_name: Optional[str]) -> PurchaseItemResponse:
    qty = getattr(item, "quantity_requested", 0.0)
    price = getattr(item, "unit_price", None) or 0.0
    return PurchaseItemResponse(
        id=item.id,
        request_id=item.request_id,
        estimate_item_id=getattr(item, "estimate_item_id", None),
        name=item.name,
        unit=getattr(item, "unit", None),
        quantity_requested=qty,
        quantity_delivered=getattr(item, "quantity_delivered", None),
        supplier_id=getattr(item, "supplier_id", None),
        supplier_name=supplier_name,
        unit_price=getattr(item, "unit_price", None),
        total=qty * price,
        notes=getattr(item, "notes", None),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{project_id}/purchases", response_model=list[PurchaseRequestResponse])
async def list_purchases(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = Query(None),
):
    await _get_project_owned(project_id, current_user.id, db)

    q = select(PurchaseRequest).where(PurchaseRequest.project_id == project_id)
    if status:
        q = q.where(PurchaseRequest.status == status)

    result = await db.execute(q)
    requests = result.scalars().all()
    return [await _enrich_request(req, db) for req in requests]


@router.post("/{project_id}/purchases", response_model=PurchaseRequestResponse, status_code=201)
async def create_purchase(
    project_id: str,
    body: PurchaseRequestCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    req = PurchaseRequest(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=body.title,
        status="draft",
        notes=body.notes,
        requested_by=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return await _enrich_request(req, db)


@router.patch("/{project_id}/purchases/{req_id}", response_model=PurchaseRequestResponse)
async def update_purchase(
    project_id: str,
    req_id: str,
    body: PurchaseRequestPatch,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    req = await db.get(PurchaseRequest, req_id)
    if not req or req.project_id != project_id:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if hasattr(req, field):
            setattr(req, field, value)

    await db.commit()
    await db.refresh(req)
    return await _enrich_request(req, db)


@router.delete("/{project_id}/purchases/{req_id}", status_code=204)
async def delete_purchase(
    project_id: str,
    req_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    req = await db.get(PurchaseRequest, req_id)
    if not req or req.project_id != project_id:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    if req.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft purchase requests can be deleted")

    items_result = await db.execute(
        select(PurchaseRequestItem).where(PurchaseRequestItem.request_id == req_id)
    )
    for item in items_result.scalars().all():
        await db.delete(item)

    await db.delete(req)
    await db.commit()


@router.get(
    "/{project_id}/purchases/{req_id}/items",
    response_model=list[PurchaseItemResponse],
)
async def list_purchase_items(
    project_id: str,
    req_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    req = await db.get(PurchaseRequest, req_id)
    if not req or req.project_id != project_id:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    items_result = await db.execute(
        select(PurchaseRequestItem).where(PurchaseRequestItem.request_id == req_id)
    )
    items = items_result.scalars().all()

    result = []
    for item in items:
        supplier_name = await _get_supplier_name(getattr(item, "supplier_id", None), db)
        result.append(_item_response(item, supplier_name))
    return result


@router.put(
    "/{project_id}/purchases/{req_id}/items",
    response_model=list[PurchaseItemResponse],
)
async def replace_purchase_items(
    project_id: str,
    req_id: str,
    body: list[PurchaseItemIn],
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    req = await db.get(PurchaseRequest, req_id)
    if not req or req.project_id != project_id:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    # Delete existing items
    existing_result = await db.execute(
        select(PurchaseRequestItem).where(PurchaseRequestItem.request_id == req_id)
    )
    for item in existing_result.scalars().all():
        await db.delete(item)

    # Insert new items
    new_items = []
    for line in body:
        new_item = PurchaseRequestItem(
            id=str(uuid.uuid4()),
            request_id=req_id,
            estimate_item_id=line.estimate_item_id,
            name=line.name,
            unit=line.unit,
            quantity_requested=line.quantity_requested,
            quantity_delivered=line.quantity_delivered,
            supplier_id=line.supplier_id,
            unit_price=line.unit_price,
            notes=line.notes,
        )
        db.add(new_item)
        new_items.append(new_item)

    await db.commit()

    result = []
    for item in new_items:
        supplier_name = await _get_supplier_name(getattr(item, "supplier_id", None), db)
        result.append(_item_response(item, supplier_name))
    return result


@router.patch(
    "/{project_id}/purchases/{req_id}/items/{item_id}",
    response_model=PurchaseItemResponse,
)
async def update_purchase_item(
    project_id: str,
    req_id: str,
    item_id: str,
    body: PurchaseItemPatch,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    req = await db.get(PurchaseRequest, req_id)
    if not req or req.project_id != project_id:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    item = await db.get(PurchaseRequestItem, item_id)
    if not item or item.request_id != req_id:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if hasattr(item, field):
            setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    supplier_name = await _get_supplier_name(getattr(item, "supplier_id", None), db)
    return _item_response(item, supplier_name)


@router.get(
    "/{project_id}/purchases/materials-summary",
    response_model=list[MaterialsSummaryItem],
)
async def materials_summary(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    # Get tasks for this project
    tasks_result = await db.execute(
        select(Task).where(Task.project_id == project_id)
    )
    task_ids = [t.id for t in tasks_result.scalars().all()]

    # Get material items from estimate
    estimate_materials: list[EstimateItem] = []
    if task_ids:
        est_result = await db.execute(
            select(EstimateItem).where(
                and_(
                    EstimateItem.task_id.in_(task_ids),
                    EstimateItem.type == "Материал",
                )
            )
        )
        estimate_materials = est_result.scalars().all()

    est_item_ids = [ei.id for ei in estimate_materials]
    est_item_map = {ei.id: ei for ei in estimate_materials}

    # Aggregate purchase request items
    req_result = await db.execute(
        select(PurchaseRequest).where(PurchaseRequest.project_id == project_id)
    )
    req_ids = [r.id for r in req_result.scalars().all()]

    requested_map: dict[str, float] = {}
    delivered_map: dict[str, float] = {}
    standalone_items: dict[str, dict] = {}  # items without estimate_item_id

    if req_ids:
        items_result = await db.execute(
            select(PurchaseRequestItem).where(PurchaseRequestItem.request_id.in_(req_ids))
        )
        for item in items_result.scalars().all():
            eid = getattr(item, "estimate_item_id", None)
            qty_req = getattr(item, "quantity_requested", 0.0) or 0.0
            qty_del = getattr(item, "quantity_delivered", None) or 0.0

            if eid:
                requested_map[eid] = requested_map.get(eid, 0.0) + qty_req
                delivered_map[eid] = delivered_map.get(eid, 0.0) + qty_del
            else:
                # Track standalone purchase items by name
                key = item.name
                if key not in standalone_items:
                    standalone_items[key] = {
                        "name": item.name,
                        "unit": getattr(item, "unit", "") or "",
                        "quantity_requested": 0.0,
                        "quantity_delivered": 0.0,
                    }
                standalone_items[key]["quantity_requested"] += qty_req
                standalone_items[key]["quantity_delivered"] += qty_del

    summary = []

    # Items from estimate
    for ei in estimate_materials:
        summary.append(
            MaterialsSummaryItem(
                estimate_item_id=ei.id,
                name=ei.name,
                unit=ei.unit or "",
                quantity_in_estimate=ei.quantity,
                quantity_requested=requested_map.get(ei.id, 0.0),
                quantity_delivered=delivered_map.get(ei.id, 0.0),
            )
        )

    # Standalone purchase items not linked to estimate
    for data in standalone_items.values():
        summary.append(
            MaterialsSummaryItem(
                estimate_item_id=None,
                name=data["name"],
                unit=data["unit"],
                quantity_in_estimate=0.0,
                quantity_requested=data["quantity_requested"],
                quantity_delivered=data["quantity_delivered"],
            )
        )

    return summary
