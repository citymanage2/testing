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
from app.models.contractor import Contractor

router = APIRouter()

KINDS = {"client", "supplier", "subcontractor"}


class ContractorIn(BaseModel):
    kind: str = "client"
    name: str
    inn: Optional[str] = None
    kpp: Optional[str] = None
    address: Optional[str] = None
    contact: Optional[str] = None
    notes: Optional[str] = None


class ContractorOut(BaseModel):
    id: str
    kind: str
    name: str
    inn: Optional[str]
    kpp: Optional[str]
    address: Optional[str]
    contact: Optional[str]
    notes: Optional[str]
    created_at: datetime


@router.get("", response_model=list[ContractorOut])
async def list_contractors(
    kind: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Contractor).where(Contractor.user_id == current_user.id)
    if kind:
        q = q.where(Contractor.kind == kind)
    q = q.order_by(Contractor.name)
    rows = (await db.execute(q)).scalars().all()
    return [ContractorOut(id=r.id, kind=r.kind, name=r.name, inn=r.inn, kpp=r.kpp, address=r.address, contact=r.contact, notes=r.notes, created_at=r.created_at) for r in rows]


@router.post("", response_model=ContractorOut)
async def create_contractor(
    body: ContractorIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {KINDS}")
    row = Contractor(
        id=str(uuid.uuid4()), user_id=current_user.id,
        kind=body.kind, name=body.name, inn=body.inn, kpp=body.kpp,
        address=body.address, contact=body.contact, notes=body.notes,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ContractorOut(id=row.id, kind=row.kind, name=row.name, inn=row.inn, kpp=row.kpp, address=row.address, contact=row.contact, notes=row.notes, created_at=row.created_at)


@router.get("/{contractor_id}", response_model=ContractorOut)
async def get_contractor(
    contractor_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Contractor, contractor_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    return ContractorOut(id=row.id, kind=row.kind, name=row.name, inn=row.inn, kpp=row.kpp, address=row.address, contact=row.contact, notes=row.notes, created_at=row.created_at)


@router.put("/{contractor_id}", response_model=ContractorOut)
async def update_contractor(
    contractor_id: str,
    body: ContractorIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Contractor, contractor_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    if body.kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {KINDS}")
    row.kind = body.kind
    row.name = body.name
    row.inn = body.inn
    row.kpp = body.kpp
    row.address = body.address
    row.contact = body.contact
    row.notes = body.notes
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return ContractorOut(id=row.id, kind=row.kind, name=row.name, inn=row.inn, kpp=row.kpp, address=row.address, contact=row.contact, notes=row.notes, created_at=row.created_at)


@router.delete("/{contractor_id}")
async def delete_contractor(
    contractor_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Contractor, contractor_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
