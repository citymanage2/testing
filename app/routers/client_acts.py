import io
import uuid
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel

from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project import Project
from app.models.client_act import ClientKs2Act, ClientKs2ActItem
from app.models.estimate_item import EstimateItem
from app.models.task import Task

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ActCreate(BaseModel):
    act_number: str
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    contractor_id: Optional[str] = None
    notes: Optional[str] = None


class ActPatch(BaseModel):
    act_number: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    signed_at: Optional[datetime] = None
    contractor_id: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class ActResponse(BaseModel):
    id: str
    project_id: str
    act_number: str
    status: str
    period_start: Optional[date]
    period_end: Optional[date]
    contractor_id: Optional[str]
    notes: Optional[str]
    signed_at: Optional[datetime]
    items_count: int
    total_amount: float
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ActItemIn(BaseModel):
    estimate_item_id: str
    quantity_presented: float
    unit_price: Optional[float] = None


class ActItemResponse(BaseModel):
    id: str
    act_id: str
    estimate_item_id: str
    estimate_item_name: Optional[str]
    estimate_item_unit: Optional[str]
    estimate_item_quantity_total: Optional[float]
    already_actioned_qty: float
    remaining_qty: float
    quantity_presented: float
    unit_price: float
    total: float

    model_config = {"from_attributes": True}


class ActioningSummaryItem(BaseModel):
    estimate_item_id: str
    name: str
    unit: str
    quantity_total: float
    quantity_actioned: float
    quantity_remaining: float
    pct_actioned: float


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


async def _enrich_act(act: ClientKs2Act, db: AsyncSession) -> ActResponse:
    items_result = await db.execute(
        select(ClientKs2ActItem).where(ClientKs2ActItem.act_id == act.id)
    )
    items = items_result.scalars().all()
    items_count = len(items)
    total_amount = sum(
        getattr(i, "quantity_presented", 0.0) * getattr(i, "unit_price", 0.0)
        for i in items
    )
    return ActResponse(
        id=act.id,
        project_id=act.project_id,
        act_number=act.act_number,
        status=act.status,
        period_start=getattr(act, "period_start", None),
        period_end=getattr(act, "period_end", None),
        contractor_id=getattr(act, "contractor_id", None),
        notes=getattr(act, "notes", None),
        signed_at=getattr(act, "signed_at", None),
        items_count=items_count,
        total_amount=total_amount,
        created_at=getattr(act, "created_at", None),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{project_id}/client-acts", response_model=list[ActResponse])
async def list_acts(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    result = await db.execute(
        select(ClientKs2Act).where(ClientKs2Act.project_id == project_id)
    )
    acts = result.scalars().all()
    return [await _enrich_act(act, db) for act in acts]


@router.post("/{project_id}/client-acts", response_model=ActResponse, status_code=201)
async def create_act(
    project_id: str,
    body: ActCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    act = ClientKs2Act(
        id=str(uuid.uuid4()),
        project_id=project_id,
        act_number=body.act_number,
        status="draft",
        period_start=body.period_start,
        period_end=body.period_end,
        contractor_id=body.contractor_id,
        notes=body.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(act)
    await db.commit()
    await db.refresh(act)
    return await _enrich_act(act, db)


@router.patch("/{project_id}/client-acts/{act_id}", response_model=ActResponse)
async def update_act(
    project_id: str,
    act_id: str,
    body: ActPatch,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    act = await db.get(ClientKs2Act, act_id)
    if not act or act.project_id != project_id:
        raise HTTPException(status_code=404, detail="Act not found")

    updates = body.model_dump(exclude_none=True)

    if "status" in updates and updates["status"] == "signed":
        if not updates.get("signed_at") and not getattr(act, "signed_at", None):
            act.signed_at = datetime.now(timezone.utc)

    for field, value in updates.items():
        if hasattr(act, field):
            setattr(act, field, value)

    await db.commit()
    await db.refresh(act)
    return await _enrich_act(act, db)


@router.delete("/{project_id}/client-acts/{act_id}", status_code=204)
async def delete_act(
    project_id: str,
    act_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    act = await db.get(ClientKs2Act, act_id)
    if not act or act.project_id != project_id:
        raise HTTPException(status_code=404, detail="Act not found")

    if act.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft acts can be deleted")

    items_result = await db.execute(
        select(ClientKs2ActItem).where(ClientKs2ActItem.act_id == act_id)
    )
    for item in items_result.scalars().all():
        await db.delete(item)

    await db.delete(act)
    await db.commit()


@router.get("/{project_id}/client-acts/{act_id}/items", response_model=list[ActItemResponse])
async def list_act_items(
    project_id: str,
    act_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    act = await db.get(ClientKs2Act, act_id)
    if not act or act.project_id != project_id:
        raise HTTPException(status_code=404, detail="Act not found")

    items_result = await db.execute(
        select(ClientKs2ActItem).where(ClientKs2ActItem.act_id == act_id)
    )
    items = items_result.scalars().all()

    response_items = []
    for item in items:
        est_item = await db.get(EstimateItem, item.estimate_item_id)

        # Sum from other non-cancelled acts
        already_result = await db.execute(
            select(func.sum(ClientKs2ActItem.quantity_presented)).where(
                and_(
                    ClientKs2ActItem.estimate_item_id == item.estimate_item_id,
                    ClientKs2ActItem.act_id != act_id,
                )
            ).join(
                ClientKs2Act, ClientKs2Act.id == ClientKs2ActItem.act_id
            ).where(
                and_(
                    ClientKs2Act.project_id == project_id,
                    ClientKs2Act.status != "cancelled",
                )
            )
        )
        already_actioned = already_result.scalar() or 0.0
        est_qty = est_item.quantity if est_item else 0.0
        remaining = est_qty - already_actioned

        response_items.append(
            ActItemResponse(
                id=item.id,
                act_id=item.act_id,
                estimate_item_id=item.estimate_item_id,
                estimate_item_name=est_item.name if est_item else None,
                estimate_item_unit=est_item.unit if est_item else None,
                estimate_item_quantity_total=est_qty if est_item else None,
                already_actioned_qty=already_actioned,
                remaining_qty=remaining,
                quantity_presented=item.quantity_presented,
                unit_price=item.unit_price,
                total=item.quantity_presented * item.unit_price,
            )
        )

    return response_items


@router.put("/{project_id}/client-acts/{act_id}/items", response_model=list[ActItemResponse])
async def replace_act_items(
    project_id: str,
    act_id: str,
    body: list[ActItemIn],
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    act = await db.get(ClientKs2Act, act_id)
    if not act or act.project_id != project_id:
        raise HTTPException(status_code=404, detail="Act not found")

    # Validate each line
    for line in body:
        est_item = await db.get(EstimateItem, line.estimate_item_id)
        if not est_item:
            raise HTTPException(
                status_code=400,
                detail=f"Estimate item {line.estimate_item_id} not found",
            )

        # Sum from other non-cancelled acts (exclude current act)
        already_result = await db.execute(
            select(func.sum(ClientKs2ActItem.quantity_presented)).select_from(
                ClientKs2ActItem
            ).join(
                ClientKs2Act, ClientKs2Act.id == ClientKs2ActItem.act_id
            ).where(
                and_(
                    ClientKs2ActItem.estimate_item_id == line.estimate_item_id,
                    ClientKs2ActItem.act_id != act_id,
                    ClientKs2Act.project_id == project_id,
                    ClientKs2Act.status != "cancelled",
                )
            )
        )
        already_actioned = already_result.scalar() or 0.0
        remaining = est_item.quantity - already_actioned

        if line.quantity_presented > remaining:
            raise HTTPException(
                status_code=400,
                detail=f"Превышен доступный остаток по позиции '{est_item.name}': "
                       f"доступно {remaining}",
            )

    # Delete existing items
    existing_result = await db.execute(
        select(ClientKs2ActItem).where(ClientKs2ActItem.act_id == act_id)
    )
    for old_item in existing_result.scalars().all():
        await db.delete(old_item)

    # Insert new items
    new_items = []
    for line in body:
        est_item = await db.get(EstimateItem, line.estimate_item_id)
        unit_price = line.unit_price
        if unit_price is None:
            # Fall back to sale_price on EstimateItem or work_price
            unit_price = getattr(est_item, "sale_price", None) or (
                est_item.work_price + est_item.mat_price if est_item else 0.0
            )

        new_item = ClientKs2ActItem(
            id=str(uuid.uuid4()),
            act_id=act_id,
            estimate_item_id=line.estimate_item_id,
            quantity_presented=line.quantity_presented,
            unit_price=unit_price,
        )
        db.add(new_item)
        new_items.append((new_item, est_item))

    await db.commit()

    response_items = []
    for item, est_item in new_items:
        already_result = await db.execute(
            select(func.sum(ClientKs2ActItem.quantity_presented)).select_from(
                ClientKs2ActItem
            ).join(
                ClientKs2Act, ClientKs2Act.id == ClientKs2ActItem.act_id
            ).where(
                and_(
                    ClientKs2ActItem.estimate_item_id == item.estimate_item_id,
                    ClientKs2ActItem.act_id != act_id,
                    ClientKs2Act.project_id == project_id,
                    ClientKs2Act.status != "cancelled",
                )
            )
        )
        already_actioned = already_result.scalar() or 0.0
        est_qty = est_item.quantity if est_item else 0.0

        response_items.append(
            ActItemResponse(
                id=item.id,
                act_id=item.act_id,
                estimate_item_id=item.estimate_item_id,
                estimate_item_name=est_item.name if est_item else None,
                estimate_item_unit=est_item.unit if est_item else None,
                estimate_item_quantity_total=est_qty if est_item else None,
                already_actioned_qty=already_actioned,
                remaining_qty=est_qty - already_actioned,
                quantity_presented=item.quantity_presented,
                unit_price=item.unit_price,
                total=item.quantity_presented * item.unit_price,
            )
        )

    return response_items


@router.get(
    "/{project_id}/actioning-summary",
    response_model=list[ActioningSummaryItem],
)
async def actioning_summary(
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

    if not task_ids:
        return []

    # Get all non-header estimate items for this project
    items_result = await db.execute(
        select(EstimateItem).where(
            and_(
                EstimateItem.task_id.in_(task_ids),
                EstimateItem.row_type != "section_header",
            )
        ).order_by(EstimateItem.sort_order, EstimateItem.position)
    )
    estimate_items = items_result.scalars().all()

    # Get all actioned quantities from non-cancelled acts
    actioned_result = await db.execute(
        select(
            ClientKs2ActItem.estimate_item_id,
            func.sum(ClientKs2ActItem.quantity_presented).label("total_actioned"),
        ).select_from(ClientKs2ActItem).join(
            ClientKs2Act, ClientKs2Act.id == ClientKs2ActItem.act_id
        ).where(
            and_(
                ClientKs2Act.project_id == project_id,
                ClientKs2Act.status != "cancelled",
            )
        ).group_by(ClientKs2ActItem.estimate_item_id)
    )
    actioned_map: dict[str, float] = {
        row.estimate_item_id: float(row.total_actioned)
        for row in actioned_result.fetchall()
    }

    summary = []
    for ei in estimate_items:
        actioned = actioned_map.get(ei.id, 0.0)
        remaining = ei.quantity - actioned
        pct = (actioned / ei.quantity * 100.0) if ei.quantity else 0.0
        summary.append(
            ActioningSummaryItem(
                estimate_item_id=ei.id,
                name=ei.name,
                unit=ei.unit or "",
                quantity_total=ei.quantity,
                quantity_actioned=actioned,
                quantity_remaining=remaining,
                pct_actioned=round(pct, 2),
            )
        )

    return summary


@router.get("/{project_id}/client-acts/{act_id}/export-ks2")
async def export_ks2(
    project_id: str,
    act_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        import openpyxl
        from openpyxl.styles import Font, Alignment, Border, Side
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl is not installed")

    await _get_project_owned(project_id, current_user.id, db)

    act = await db.get(ClientKs2Act, act_id)
    if not act or act.project_id != project_id:
        raise HTTPException(status_code=404, detail="Act not found")

    items_result = await db.execute(
        select(ClientKs2ActItem).where(ClientKs2ActItem.act_id == act_id)
    )
    act_items = items_result.scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "КС-2"

    bold = Font(bold=True)
    center = Alignment(horizontal="center")
    thin = Side(border_style="thin")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # Header
    ws.merge_cells("A1:G1")
    ws["A1"] = f"Акт КС-2 № {act.act_number}"
    ws["A1"].font = bold
    ws["A1"].alignment = center

    period_start = getattr(act, "period_start", "")
    period_end = getattr(act, "period_end", "")
    ws.merge_cells("A2:G2")
    ws["A2"] = f"Период: {period_start} — {period_end}"
    ws["A2"].alignment = center

    # Column headers
    headers = ["№", "Наименование работ", "Ед. изм.", "Кол-во", "Цена", "Сумма", "Прим."]
    ws.append([""] * 7)  # spacer row
    ws.append(headers)
    header_row = ws.max_row
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=header_row, column=col_idx)
        cell.font = bold
        cell.alignment = center
        cell.border = border

    # Data rows
    total_amount = 0.0
    for idx, item in enumerate(act_items, start=1):
        est_item = await db.get(EstimateItem, item.estimate_item_id)
        name = est_item.name if est_item else item.estimate_item_id
        unit = est_item.unit if est_item else ""
        qty = item.quantity_presented
        price = item.unit_price
        amount = qty * price
        total_amount += amount
        notes = ""

        row_data = [idx, name, unit, qty, price, amount, notes]
        ws.append(row_data)
        data_row = ws.max_row
        for col_idx in range(1, 8):
            ws.cell(row=data_row, column=col_idx).border = border

    # Totals row
    ws.append(["", "ИТОГО", "", "", "", total_amount, ""])
    total_row = ws.max_row
    ws.cell(row=total_row, column=2).font = bold
    ws.cell(row=total_row, column=6).font = bold
    for col_idx in range(1, 8):
        ws.cell(row=total_row, column=col_idx).border = border

    # Adjust column widths
    col_widths = [5, 50, 10, 10, 12, 14, 12]
    for col_idx, width in enumerate(col_widths, start=1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    xlsx_data = buf.read()

    filename = f"ks2_act_{act.act_number}.xlsx"
    return Response(
        content=xlsx_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
