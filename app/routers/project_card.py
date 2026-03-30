"""Project card Phase 4 — address/client/dates, gallery, payments, financial summary."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.project_gallery import ProjectGallery
from app.models.project_payment import ProjectPayment
from app.models.task import Task
from app.models.estimate_item import EstimateItem
from app.models.contractor import Contractor

router = APIRouter()

ALLOWED_IMAGE_MIME = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_GALLERY_IMAGES = 20

PROJECT_STATUSES = {"active", "paused", "completed", "cancelled"}


# ─── Project detail (extended) ────────────────────────────────────────────────

class ProjectCardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    client_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    budget_planned: Optional[float] = None
    notes: Optional[str] = None


class ProjectCardOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    address: Optional[str]
    client_id: Optional[str]
    client_name: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    status: Optional[str]
    budget_planned: Optional[float]
    notes: Optional[str]
    gallery_count: int
    created_at: datetime
    updated_at: datetime


@router.get("/{project_id}/card", response_model=ProjectCardOut)
async def get_project_card(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    gallery_count = (await db.execute(select(func.count()).where(ProjectGallery.project_id == project_id))).scalar() or 0
    client_name = None
    if project.client_id:
        c = await db.get(Contractor, project.client_id)
        client_name = c.name if c else None
    return ProjectCardOut(
        id=project.id, name=project.name, description=project.description,
        address=project.address, client_id=project.client_id, client_name=client_name,
        start_date=project.start_date, end_date=project.end_date,
        status=project.status, budget_planned=float(project.budget_planned) if project.budget_planned else None,
        notes=project.notes, gallery_count=gallery_count,
        created_at=project.created_at, updated_at=project.updated_at,
    )


@router.patch("/{project_id}/card", response_model=ProjectCardOut)
async def update_project_card(
    project_id: str,
    body: ProjectCardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    if body.status and body.status not in PROJECT_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {PROJECT_STATUSES}")
    for field in ("name", "description", "address", "client_id", "start_date", "end_date", "status", "notes"):
        val = getattr(body, field)
        if val is not None:
            setattr(project, field, val)
    if body.budget_planned is not None:
        project.budget_planned = Decimal(str(body.budget_planned))
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)
    gallery_count = (await db.execute(select(func.count()).where(ProjectGallery.project_id == project_id))).scalar() or 0
    client_name = None
    if project.client_id:
        c = await db.get(Contractor, project.client_id)
        client_name = c.name if c else None
    return ProjectCardOut(
        id=project.id, name=project.name, description=project.description,
        address=project.address, client_id=project.client_id, client_name=client_name,
        start_date=project.start_date, end_date=project.end_date,
        status=project.status, budget_planned=float(project.budget_planned) if project.budget_planned else None,
        notes=project.notes, gallery_count=gallery_count,
        created_at=project.created_at, updated_at=project.updated_at,
    )


# ─── Gallery ──────────────────────────────────────────────────────────────────

class GalleryMeta(BaseModel):
    id: int
    file_name: str
    mime_type: str
    caption: Optional[str]
    uploaded_at: datetime


@router.get("/{project_id}/gallery", response_model=list[GalleryMeta])
async def list_gallery(project_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(ProjectGallery).where(ProjectGallery.project_id == project_id).order_by(ProjectGallery.uploaded_at.desc()))).scalars().all()
    return [GalleryMeta(id=r.id, file_name=r.file_name, mime_type=r.mime_type, caption=r.caption, uploaded_at=r.uploaded_at) for r in rows]


@router.post("/{project_id}/gallery", response_model=GalleryMeta)
async def upload_gallery_image(
    project_id: str,
    caption: Optional[str] = None,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    if file.content_type not in ALLOWED_IMAGE_MIME:
        raise HTTPException(status_code=400, detail="Только изображения PNG/JPEG/WebP/GIF")
    count = (await db.execute(select(func.count()).where(ProjectGallery.project_id == project_id))).scalar() or 0
    if count >= MAX_GALLERY_IMAGES:
        raise HTTPException(status_code=400, detail=f"Максимум {MAX_GALLERY_IMAGES} изображений на проект")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Максимальный размер изображения — 5MB")
    row = ProjectGallery(project_id=project_id, file_name=file.filename or "image.jpg", mime_type=file.content_type, file_data=data, caption=caption, uploaded_by=current_user.id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return GalleryMeta(id=row.id, file_name=row.file_name, mime_type=row.mime_type, caption=row.caption, uploaded_at=row.uploaded_at)


@router.get("/{project_id}/gallery/{img_id}")
async def get_gallery_image(project_id: str, img_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(ProjectGallery, img_id)
    if not row or row.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(content=row.file_data, media_type=row.mime_type)


@router.delete("/{project_id}/gallery/{img_id}")
async def delete_gallery_image(project_id: str, img_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(ProjectGallery, img_id)
    if not row or row.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


# ─── Payments ─────────────────────────────────────────────────────────────────

class PaymentIn(BaseModel):
    direction: str  # income | expense
    amount: float
    paid_at: date
    description: Optional[str] = None
    contractor_id: Optional[str] = None


class PaymentOut(BaseModel):
    id: str
    direction: str
    amount: float
    paid_at: date
    description: Optional[str]
    contractor_id: Optional[str]
    contractor_name: Optional[str]
    created_at: datetime


@router.get("/{project_id}/payments", response_model=list[PaymentOut])
async def list_payments(project_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(ProjectPayment).where(ProjectPayment.project_id == project_id).order_by(ProjectPayment.paid_at.desc()))).scalars().all()
    result = []
    for r in rows:
        cname = None
        if r.contractor_id:
            c = await db.get(Contractor, r.contractor_id)
            cname = c.name if c else None
        result.append(PaymentOut(id=r.id, direction=r.direction, amount=float(r.amount), paid_at=r.paid_at, description=r.description, contractor_id=r.contractor_id, contractor_name=cname, created_at=r.created_at))
    return result


@router.post("/{project_id}/payments", response_model=PaymentOut)
async def add_payment(
    project_id: str,
    body: PaymentIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    if body.direction not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="direction must be income or expense")
    row = ProjectPayment(
        id=str(uuid.uuid4()), project_id=project_id, direction=body.direction,
        amount=Decimal(str(body.amount)), paid_at=body.paid_at,
        description=body.description, contractor_id=body.contractor_id, created_by=current_user.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    cname = None
    if row.contractor_id:
        c = await db.get(Contractor, row.contractor_id)
        cname = c.name if c else None
    return PaymentOut(id=row.id, direction=row.direction, amount=float(row.amount), paid_at=row.paid_at, description=row.description, contractor_id=row.contractor_id, contractor_name=cname, created_at=row.created_at)


@router.delete("/{project_id}/payments/{payment_id}")
async def delete_payment(project_id: str, payment_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(ProjectPayment, payment_id)
    if not row or row.project_id != project_id:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


# ─── Financial summary ─────────────────────────────────────────────────────────

class FinancialSummary(BaseModel):
    budget_planned: Optional[float]
    estimate_total: float
    income_received: float
    expenses_paid: float
    balance: float
    budget_remaining: Optional[float]


@router.get("/{project_id}/financial-summary", response_model=FinancialSummary)
async def financial_summary(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    # Estimate total from all tasks in this project
    tasks = (await db.execute(select(Task).where(Task.project_id == project_id))).scalars().all()
    estimate_total = 0.0
    for task in tasks:
        items = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task.id))).scalars().all()
        extras = task.extras or {}
        base = sum((i.work_price + i.mat_price) * i.quantity for i in items if getattr(i, "row_type", "item") != "section_header")
        overhead = extras.get("overhead_sum", 0) + base * extras.get("overhead_pct", 0) / 100
        transport = extras.get("transport_sum", 0) + base * extras.get("transport_pct", 0) / 100
        contingency = extras.get("contingency_sum", 0) + base * extras.get("contingency_pct", 0) / 100
        vat_rate = extras.get("vat_rate", 20.0)
        grand_base = base + overhead + transport + contingency
        estimate_total += round(grand_base * (1 + vat_rate / 100), 2)

    payments = (await db.execute(select(ProjectPayment).where(ProjectPayment.project_id == project_id))).scalars().all()
    income = sum(float(p.amount) for p in payments if p.direction == "income")
    expenses = sum(float(p.amount) for p in payments if p.direction == "expense")
    budget = float(project.budget_planned) if project.budget_planned else None

    return FinancialSummary(
        budget_planned=budget,
        estimate_total=round(estimate_total, 2),
        income_received=round(income, 2),
        expenses_paid=round(expenses, 2),
        balance=round(income - expenses, 2),
        budget_remaining=round(budget - expenses, 2) if budget is not None else None,
    )
