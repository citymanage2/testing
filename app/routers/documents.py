"""Document generation endpoints: estimate Excel, KS-2, KS-3."""
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.task import Task
from app.models.estimate_item import EstimateItem
from app.models.company import CompanySettings
from app.models.contractor import Contractor
from app.models.generated_document import GeneratedDocument
from app.models.work_acceptance import WorkAcceptance, WorkAcceptanceItem
from app.services.ks_service import build_ks2, build_ks3, build_estimate_xlsx

router = APIRouter()

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _company_dict(row: CompanySettings | None) -> dict | None:
    if not row:
        return None
    return {"name": row.name, "inn": row.inn or "", "kpp": row.kpp or "", "ogrn": row.ogrn or "", "address": row.address or ""}


def _contractor_dict(row: Contractor | None) -> dict | None:
    if not row:
        return None
    return {"name": row.name, "inn": row.inn or "", "kpp": row.kpp or "", "address": row.address or ""}


async def _get_task_items(task_id: str, user_id: str, db: AsyncSession):
    task = await db.get(Task, task_id)
    if not task or task.user_id != user_id:
        raise HTTPException(status_code=404, detail="Task not found")
    items = (await db.execute(
        select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.sort_order, EstimateItem.position)
    )).scalars().all()
    extras = task.extras or {}
    vat_rate = extras.get("vat_rate", 20.0)
    return task, items, extras, vat_rate


async def _get_company(user_id: str, db: AsyncSession) -> CompanySettings | None:
    return (await db.execute(select(CompanySettings).where(CompanySettings.user_id == user_id))).scalar_one_or_none()


async def _save_doc(task_id: str, user_id: str, doc_kind: str, file_name: str, data: bytes, mime: str, params: dict, db: AsyncSession) -> GeneratedDocument:
    doc = GeneratedDocument(
        id=str(uuid.uuid4()), task_id=task_id, doc_kind=doc_kind,
        file_name=file_name, file_data=data, mime_type=mime,
        created_by=user_id, params=params,
    )
    db.add(doc)
    await db.commit()
    return doc


# ─── Estimate Excel ───────────────────────────────────────────────────────────

class EstimateDocParams(BaseModel):
    title: Optional[str] = None
    contractor_id: Optional[str] = None


@router.post("/estimates/{task_id}/documents/estimate-xlsx")
async def generate_estimate_xlsx(
    task_id: str,
    body: EstimateDocParams = EstimateDocParams(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task, items, extras, vat_rate = await _get_task_items(task_id, current_user.id, db)
    company_row = await _get_company(current_user.id, db)
    title = body.title or task.name or f"Смета {task_id[:8]}"
    data = build_estimate_xlsx(items, extras, _company_dict(company_row), title, vat_rate)
    file_name = f"smeta_{task_id[:8]}.xlsx"
    await _save_doc(task_id, current_user.id, "estimate_xlsx", file_name, data, XLSX_MIME, {"title": title}, db)
    return Response(content=data, media_type=XLSX_MIME, headers={"Content-Disposition": f'attachment; filename="{file_name}"'})


# ─── KS-2 ─────────────────────────────────────────────────────────────────────

class KS2Params(BaseModel):
    contractor_id: Optional[str] = None
    period_start: date
    period_end: date
    act_number: str = "1"
    acceptance_id: Optional[str] = None  # if set, use only items from this acceptance


class _AcceptanceItemProxy:
    """Duck-typed proxy so build_ks2 can consume acceptance items as if they were EstimateItems."""
    def __init__(self, est_item: EstimateItem, qty_accepted: float):
        self.row_type = getattr(est_item, "row_type", "item")
        self.name = est_item.name
        self.unit = est_item.unit
        self.section = est_item.section
        self.quantity = qty_accepted
        self.work_price = est_item.work_price
        self.mat_price = est_item.mat_price
        self.position = est_item.position


@router.post("/estimates/{task_id}/documents/ks2")
async def generate_ks2(
    task_id: str,
    body: KS2Params,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task, all_items, extras, vat_rate = await _get_task_items(task_id, current_user.id, db)
    company_row = await _get_company(current_user.id, db)
    contractor_row = await db.get(Contractor, body.contractor_id) if body.contractor_id else None

    if body.acceptance_id:
        acc = await db.get(WorkAcceptance, body.acceptance_id)
        if not acc or acc.estimate_id != task_id:
            raise HTTPException(status_code=404, detail="Acceptance not found")
        acc_items = (await db.execute(
            select(WorkAcceptanceItem).where(WorkAcceptanceItem.acceptance_id == body.acceptance_id)
        )).scalars().all()
        item_map = {i.id: i for i in all_items}
        items = [_AcceptanceItemProxy(item_map[ai.estimate_item_id], ai.quantity_accepted)
                 for ai in acc_items if ai.estimate_item_id in item_map]
        # use acceptance contractor if not overridden
        if not contractor_row and acc.contractor_id:
            contractor_row = await db.get(Contractor, acc.contractor_id)
        # use acceptance period if not specified
        p_start = acc.period_start or body.period_start
        p_end = acc.period_end or body.period_end
        act_num = acc.act_number
    else:
        items = all_items
        p_start = body.period_start
        p_end = body.period_end
        act_num = body.act_number

    data = build_ks2(
        items, extras, _company_dict(company_row), _contractor_dict(contractor_row),
        p_start, p_end, act_num, vat_rate,
    )
    file_name = f"ks2_act{act_num}_{task_id[:8]}.xlsx"
    await _save_doc(task_id, current_user.id, "ks2", file_name, data, XLSX_MIME,
                    {"act_number": act_num, "period_start": str(p_start), "period_end": str(p_end),
                     "acceptance_id": body.acceptance_id}, db)
    return Response(content=data, media_type=XLSX_MIME, headers={"Content-Disposition": f'attachment; filename="{file_name}"'})


# ─── KS-3 ─────────────────────────────────────────────────────────────────────

class KS3Params(BaseModel):
    contractor_id: Optional[str] = None
    period_start: date
    period_end: date
    act_number: str = "1"
    ks2_amount: Optional[float] = None  # override; if None, computed from items


@router.post("/estimates/{task_id}/documents/ks3")
async def generate_ks3(
    task_id: str,
    body: KS3Params,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task, items, extras, vat_rate = await _get_task_items(task_id, current_user.id, db)
    company_row = await _get_company(current_user.id, db)
    contractor_row = await db.get(Contractor, body.contractor_id) if body.contractor_id else None

    if body.ks2_amount is not None:
        ks2_amount = body.ks2_amount
    else:
        base = sum((i.work_price + i.mat_price) * i.quantity for i in items if getattr(i, "row_type", "item") != "section_header")
        overhead = extras.get("overhead_sum", 0) + base * extras.get("overhead_pct", 0) / 100
        transport = extras.get("transport_sum", 0) + base * extras.get("transport_pct", 0) / 100
        contingency = extras.get("contingency_sum", 0) + base * extras.get("contingency_pct", 0) / 100
        ks2_amount = round(base + overhead + transport + contingency, 2)

    data = build_ks3(ks2_amount, _company_dict(company_row), _contractor_dict(contractor_row),
                     body.period_start, body.period_end, body.act_number, vat_rate)
    file_name = f"ks3_act{body.act_number}_{task_id[:8]}.xlsx"
    await _save_doc(task_id, current_user.id, "ks3", file_name, data, XLSX_MIME,
                    {"act_number": body.act_number, "ks2_amount": ks2_amount}, db)
    return Response(content=data, media_type=XLSX_MIME, headers={"Content-Disposition": f'attachment; filename="{file_name}"'})


# ─── Document history ──────────────────────────────────────────────────────────

class DocMeta(BaseModel):
    id: str
    doc_kind: str
    file_name: str
    created_at: datetime
    params: Optional[dict]


@router.get("/estimates/{task_id}/documents", response_model=list[DocMeta])
async def list_documents(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(GeneratedDocument).where(GeneratedDocument.task_id == task_id).order_by(GeneratedDocument.created_at.desc())
    )).scalars().all()
    return [DocMeta(id=r.id, doc_kind=r.doc_kind, file_name=r.file_name, created_at=r.created_at, params=r.params) for r in rows]


@router.get("/estimates/{task_id}/documents/{doc_id}/download")
async def download_document(
    task_id: str,
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(GeneratedDocument, doc_id)
    if not row or row.task_id != task_id:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(content=row.file_data, media_type=row.mime_type,
                    headers={"Content-Disposition": f'attachment; filename="{row.file_name}"'})
