import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project import Project
from app.models.kp_request import KpRequest
from app.models.contractor import Contractor
from app.models.estimate_item import EstimateItem

router = APIRouter()


class KpRequestCreate(BaseModel):
    item_name: str
    unit: Optional[str] = None
    quantity: float = 1.0
    unit_price: float = 0.0
    notes: Optional[str] = None
    supplier_id: Optional[str] = None
    estimate_item_id: Optional[str] = None
    status: str = "pending"


class KpRequestPatch(BaseModel):
    item_name: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    notes: Optional[str] = None
    supplier_id: Optional[str] = None
    status: Optional[str] = None


class KpRequestOut(BaseModel):
    id: str
    project_id: str
    estimate_item_id: Optional[str]
    supplier_id: Optional[str]
    supplier_name: Optional[str] = None
    item_name: str
    unit: Optional[str]
    quantity: float
    unit_price: float
    total: float
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


async def _get_project(project_id: str, user_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project or project.user_id != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/kp-requests", response_model=List[KpRequestOut])
async def list_kp_requests(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, current_user.id, db)
    result = await db.execute(
        select(KpRequest).where(KpRequest.project_id == project_id)
        .order_by(KpRequest.created_at.desc())
    )
    items = result.scalars().all()
    out = []
    for item in items:
        d = KpRequestOut.model_validate(item)
        if item.supplier_id:
            supplier = await db.get(Contractor, item.supplier_id)
            d.supplier_name = supplier.name if supplier else None
        out.append(d)
    return out


@router.post("/{project_id}/kp-requests", response_model=KpRequestOut, status_code=201)
async def create_kp_request(
    project_id: str,
    body: KpRequestCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, current_user.id, db)
    now = datetime.now(timezone.utc)
    total = body.quantity * body.unit_price
    req = KpRequest(
        id=str(uuid.uuid4()),
        project_id=project_id,
        item_name=body.item_name,
        unit=body.unit,
        quantity=body.quantity,
        unit_price=body.unit_price,
        total=total,
        notes=body.notes,
        supplier_id=body.supplier_id,
        estimate_item_id=body.estimate_item_id,
        status=body.status,
        created_at=now,
        updated_at=now,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    d = KpRequestOut.model_validate(req)
    if req.supplier_id:
        supplier = await db.get(Contractor, req.supplier_id)
        d.supplier_name = supplier.name if supplier else None
    return d


@router.patch("/{project_id}/kp-requests/{req_id}", response_model=KpRequestOut)
async def update_kp_request(
    project_id: str,
    req_id: str,
    body: KpRequestPatch,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, current_user.id, db)
    req = await db.get(KpRequest, req_id)
    if not req or req.project_id != project_id:
        raise HTTPException(status_code=404, detail="KP request not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(req, k, v)
    req.total = req.quantity * req.unit_price
    req.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(req)
    d = KpRequestOut.model_validate(req)
    if req.supplier_id:
        supplier = await db.get(Contractor, req.supplier_id)
        d.supplier_name = supplier.name if supplier else None
    return d


@router.delete("/{project_id}/kp-requests/{req_id}", status_code=204)
async def delete_kp_request(
    project_id: str,
    req_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, current_user.id, db)
    req = await db.get(KpRequest, req_id)
    if not req or req.project_id != project_id:
        raise HTTPException(status_code=404, detail="KP request not found")
    await db.delete(req)
    await db.commit()
