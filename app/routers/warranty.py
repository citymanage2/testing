import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project import Project
from app.models.warranty_claim import WarrantyClaim
from app.models.notification import Notification

router = APIRouter()


class ClaimCreate(BaseModel):
    title: str
    description: Optional[str] = None
    claimed_at: Optional[date] = None
    deadline: Optional[date] = None
    assigned_to: Optional[str] = None


class ClaimPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    claimed_at: Optional[date] = None
    deadline: Optional[date] = None
    resolved_at: Optional[date] = None
    assigned_to: Optional[str] = None


class ClaimOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str]
    status: str
    claimed_at: Optional[date]
    deadline: Optional[date]
    resolved_at: Optional[date]
    assigned_to: Optional[str]
    created_at: datetime
    is_overdue: bool = False

    class Config:
        from_attributes = True


async def _get_project(project_id: str, user_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project or project.user_id != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/warranty-claims", response_model=List[ClaimOut])
async def list_claims(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, current_user.id, db)
    result = await db.execute(
        select(WarrantyClaim).where(WarrantyClaim.project_id == project_id)
        .order_by(WarrantyClaim.created_at.desc())
    )
    claims = result.scalars().all()
    today = date.today()
    out = []
    for c in claims:
        is_overdue = bool(
            c.deadline and c.deadline < today and c.status not in ("resolved",)
        )
        # Auto-notify if deadline within 30 days and open
        if c.deadline and c.status == "open":
            days_left = (c.deadline - today).days
            if 0 <= days_left <= 30:
                # Create notification if not already created recently
                notif = Notification(
                    id=str(uuid.uuid4()),
                    user_id=current_user.id,
                    type="warranty_deadline",
                    title=f"Гарантийный срок: {c.title}",
                    body=f"Срок устранения истекает через {days_left} дн. ({c.deadline})",
                    reference_type="project",
                    reference_id=project_id,
                    is_read=False,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(notif)
        d = ClaimOut.model_validate(c)
        d.is_overdue = is_overdue
        out.append(d)
    await db.commit()
    return out


@router.post("/{project_id}/warranty-claims", response_model=ClaimOut, status_code=201)
async def create_claim(
    project_id: str,
    body: ClaimCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, current_user.id, db)
    claim = WarrantyClaim(
        id=str(uuid.uuid4()),
        project_id=project_id,
        **body.model_dump(),
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)
    today = date.today()
    d = ClaimOut.model_validate(claim)
    d.is_overdue = bool(claim.deadline and claim.deadline < today and claim.status not in ("resolved",))
    return d


@router.patch("/{project_id}/warranty-claims/{claim_id}", response_model=ClaimOut)
async def update_claim(
    project_id: str,
    claim_id: str,
    body: ClaimPatch,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, current_user.id, db)
    claim = await db.get(WarrantyClaim, claim_id)
    if not claim or claim.project_id != project_id:
        raise HTTPException(status_code=404, detail="Claim not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(claim, k, v)
    await db.commit()
    await db.refresh(claim)
    today = date.today()
    d = ClaimOut.model_validate(claim)
    d.is_overdue = bool(claim.deadline and claim.deadline < today and claim.status not in ("resolved",))
    return d


@router.delete("/{project_id}/warranty-claims/{claim_id}", status_code=204)
async def delete_claim(
    project_id: str,
    claim_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, current_user.id, db)
    claim = await db.get(WarrantyClaim, claim_id)
    if not claim or claim.project_id != project_id:
        raise HTTPException(status_code=404, detail="Claim not found")
    await db.delete(claim)
    await db.commit()
