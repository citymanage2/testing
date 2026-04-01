import uuid
from datetime import datetime, timezone, date
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel

from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project import Project
from app.models.subcontractor_contract import SubcontractorContract, SubcontractorContractItem
from app.models.estimate_item import EstimateItem

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ContractCreate(BaseModel):
    contractor_id: Optional[str] = None
    contract_number: Optional[str] = None
    contract_date: Optional[date] = None
    advance_pct: float = 0.0
    guarantee_pct: float = 0.0
    notes: Optional[str] = None


class ContractPatch(BaseModel):
    contract_number: Optional[str] = None
    contract_date: Optional[date] = None
    status: Optional[str] = None
    advance_pct: Optional[float] = None
    guarantee_pct: Optional[float] = None
    notes: Optional[str] = None
    signed_at: Optional[datetime] = None


class ContractResponse(BaseModel):
    id: str
    project_id: str
    contractor_id: Optional[str]
    contractor_name: Optional[str]
    contract_number: Optional[str]
    contract_date: Optional[date]
    status: str
    advance_pct: float
    guarantee_pct: float
    notes: Optional[str]
    signed_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ContractItemIn(BaseModel):
    estimate_item_id: Optional[str] = None
    name: str
    unit: Optional[str] = None
    quantity: float
    unit_price: float
    notes: Optional[str] = None


class ContractItemResponse(BaseModel):
    id: str
    contract_id: str
    estimate_item_id: Optional[str]
    name: str
    unit: Optional[str]
    quantity: float
    unit_price: float
    total: float
    notes: Optional[str]

    model_config = {"from_attributes": True}


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


async def _get_contractor_name(contractor_id: Optional[str], db: AsyncSession) -> Optional[str]:
    if not contractor_id:
        return None
    try:
        from app.models.contractor import Contractor
        contractor = await db.get(Contractor, contractor_id)
        return getattr(contractor, "name", None) if contractor else None
    except Exception:
        return None


async def _build_contract_response(contract: SubcontractorContract, db: AsyncSession) -> ContractResponse:
    contractor_name = await _get_contractor_name(
        getattr(contract, "contractor_id", None), db
    )
    return ContractResponse(
        id=contract.id,
        project_id=contract.project_id,
        contractor_id=getattr(contract, "contractor_id", None),
        contractor_name=contractor_name,
        contract_number=getattr(contract, "contract_number", None),
        contract_date=getattr(contract, "contract_date", None),
        status=contract.status,
        advance_pct=getattr(contract, "advance_pct", 0.0),
        guarantee_pct=getattr(contract, "guarantee_pct", 0.0),
        notes=getattr(contract, "notes", None),
        signed_at=getattr(contract, "signed_at", None),
        created_at=getattr(contract, "created_at", None),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{project_id}/contracts", response_model=list[ContractResponse])
async def list_contracts(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    result = await db.execute(
        select(SubcontractorContract).where(SubcontractorContract.project_id == project_id)
    )
    contracts = result.scalars().all()
    return [await _build_contract_response(c, db) for c in contracts]


@router.post("/{project_id}/contracts", response_model=ContractResponse, status_code=201)
async def create_contract(
    project_id: str,
    body: ContractCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    contract = SubcontractorContract(
        id=str(uuid.uuid4()),
        project_id=project_id,
        contractor_id=body.contractor_id,
        contract_number=body.contract_number,
        contract_date=body.contract_date,
        status="draft",
        advance_pct=body.advance_pct,
        guarantee_pct=body.guarantee_pct,
        notes=body.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return await _build_contract_response(contract, db)


@router.patch("/{project_id}/contracts/{contract_id}", response_model=ContractResponse)
async def update_contract(
    project_id: str,
    contract_id: str,
    body: ContractPatch,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    contract = await db.get(SubcontractorContract, contract_id)
    if not contract or contract.project_id != project_id:
        raise HTTPException(status_code=404, detail="Contract not found")

    updates = body.model_dump(exclude_none=True)

    # Handle status transition to 'signed'
    if "status" in updates and updates["status"] == "signed":
        if not updates.get("signed_at") and not getattr(contract, "signed_at", None):
            contract.signed_at = datetime.now(timezone.utc)

    for field, value in updates.items():
        if hasattr(contract, field):
            setattr(contract, field, value)

    await db.commit()
    await db.refresh(contract)
    return await _build_contract_response(contract, db)


@router.delete("/{project_id}/contracts/{contract_id}", status_code=204)
async def delete_contract(
    project_id: str,
    contract_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    contract = await db.get(SubcontractorContract, contract_id)
    if not contract or contract.project_id != project_id:
        raise HTTPException(status_code=404, detail="Contract not found")

    if contract.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft contracts can be deleted")

    await db.delete(contract)
    await db.commit()


@router.get(
    "/{project_id}/contracts/{contract_id}/items",
    response_model=list[ContractItemResponse],
)
async def list_contract_items(
    project_id: str,
    contract_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    contract = await db.get(SubcontractorContract, contract_id)
    if not contract or contract.project_id != project_id:
        raise HTTPException(status_code=404, detail="Contract not found")

    result = await db.execute(
        select(SubcontractorContractItem).where(
            SubcontractorContractItem.contract_id == contract_id
        )
    )
    items = result.scalars().all()
    return [
        ContractItemResponse(
            id=item.id,
            contract_id=item.contract_id,
            estimate_item_id=getattr(item, "estimate_item_id", None),
            name=item.name,
            unit=getattr(item, "unit", None),
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item.quantity * item.unit_price,
            notes=getattr(item, "notes", None),
        )
        for item in items
    ]


@router.put(
    "/{project_id}/contracts/{contract_id}/items",
    response_model=list[ContractItemResponse],
)
async def replace_contract_items(
    project_id: str,
    contract_id: str,
    body: list[ContractItemIn],
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    contract = await db.get(SubcontractorContract, contract_id)
    if not contract or contract.project_id != project_id:
        raise HTTPException(status_code=404, detail="Contract not found")

    if contract.status == "signed":
        raise HTTPException(status_code=400, detail="Cannot edit items of a signed contract")

    # Validate estimate_item quantities
    for line in body:
        if line.estimate_item_id:
            est_item = await db.get(EstimateItem, line.estimate_item_id)
            if est_item and line.quantity > est_item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Quantity {line.quantity} exceeds estimate item quantity "
                           f"{est_item.quantity} for '{est_item.name}'",
                )

    # Delete existing items
    existing = await db.execute(
        select(SubcontractorContractItem).where(
            SubcontractorContractItem.contract_id == contract_id
        )
    )
    for item in existing.scalars().all():
        await db.delete(item)

    # Insert new items
    new_items = []
    for line in body:
        new_item = SubcontractorContractItem(
            id=str(uuid.uuid4()),
            contract_id=contract_id,
            estimate_item_id=line.estimate_item_id,
            name=line.name,
            unit=line.unit,
            quantity=line.quantity,
            unit_price=line.unit_price,
            notes=line.notes,
        )
        db.add(new_item)
        new_items.append(new_item)

    await db.commit()

    return [
        ContractItemResponse(
            id=item.id,
            contract_id=item.contract_id,
            estimate_item_id=getattr(item, "estimate_item_id", None),
            name=item.name,
            unit=getattr(item, "unit", None),
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item.quantity * item.unit_price,
            notes=getattr(item, "notes", None),
        )
        for item in new_items
    ]


@router.delete(
    "/{project_id}/contracts/{contract_id}/items/{item_id}",
    status_code=204,
)
async def delete_contract_item(
    project_id: str,
    contract_id: str,
    item_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    contract = await db.get(SubcontractorContract, contract_id)
    if not contract or contract.project_id != project_id:
        raise HTTPException(status_code=404, detail="Contract not found")

    if contract.status == "signed":
        raise HTTPException(status_code=400, detail="Cannot delete items of a signed contract")

    item = await db.get(SubcontractorContractItem, item_id)
    if not item or item.contract_id != contract_id:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)
    await db.commit()
