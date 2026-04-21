"""ГПР (Генеральный план работ) — этапы проекта v2."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.work_stage import WorkStage
from app.models.estimate_v2 import EstimatePosition, PriceLayer
from app.schemas.phase4 import (
    WorkStageCreate, WorkStageUpdate, WorkStageResponse,
    StagePositionAssign, StageWithPositions,
)

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_stage_or_404(db: AsyncSession, stage_id: str) -> WorkStage:
    stage = await db.get(WorkStage, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Этап не найден")
    return stage


# ───────────────────────── CRUD ─────────────────────────

@router.get("", response_model=list[WorkStageResponse])
async def list_stages(
    project_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    rows = (await db.execute(
        select(WorkStage)
        .where(WorkStage.project_id == project_id)
        .order_by(WorkStage.order_index, WorkStage.created_at)
    )).scalars().all()
    return rows


@router.post("", response_model=WorkStageResponse, status_code=201)
async def create_stage(
    project_id: str,
    body: WorkStageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    stage = WorkStage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        **body.model_dump(),
    )
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    return stage


@router.get("/with-positions", response_model=list[StageWithPositions])
async def list_stages_with_positions(
    project_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Возвращает этапы с агрегированными плановыми объёмами из привязанных позиций.
    Один JOIN-запрос вместо N+1.
    """
    stages = (await db.execute(
        select(WorkStage)
        .where(WorkStage.project_id == project_id)
        .order_by(WorkStage.order_index, WorkStage.created_at)
    )).scalars().all()

    if not stages:
        return []

    stage_ids = [s.id for s in stages]

    # Один агрегирующий запрос: позиции + слои цен
    agg_rows = (await db.execute(
        select(
            EstimatePosition.stage_id,
            func.count(EstimatePosition.id.distinct()).label("positions_count"),
            func.coalesce(
                func.sum(case((PriceLayer.layer_type == "client", PriceLayer.total), else_=0)),
                0,
            ).label("client_total"),
            func.coalesce(
                func.sum(case((PriceLayer.layer_type == "cost", PriceLayer.total), else_=0)),
                0,
            ).label("cost_total"),
        )
        .select_from(EstimatePosition)
        .outerjoin(PriceLayer, PriceLayer.position_id == EstimatePosition.id)
        .where(EstimatePosition.stage_id.in_(stage_ids))
        .group_by(EstimatePosition.stage_id)
    )).all()

    agg_map = {row.stage_id: row for row in agg_rows}

    return [
        StageWithPositions(
            **WorkStageResponse.model_validate(s).model_dump(),
            positions_count=agg_map[s.id].positions_count if s.id in agg_map else 0,
            client_total=Decimal(str(agg_map[s.id].client_total)) if s.id in agg_map else Decimal("0"),
            cost_total=Decimal(str(agg_map[s.id].cost_total)) if s.id in agg_map else Decimal("0"),
        )
        for s in stages
    ]


@router.get("/{stage_id}", response_model=WorkStageResponse)
async def get_stage(
    stage_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await _get_stage_or_404(db, stage_id)


@router.patch("/{stage_id}", response_model=WorkStageResponse)
async def update_stage(
    stage_id: str,
    body: WorkStageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    stage = await _get_stage_or_404(db, stage_id)
    data = body.model_dump(exclude_unset=True)
    if "status" in data:
        from app.models.work_stage import STAGE_STATUSES
        if data["status"] not in STAGE_STATUSES:
            raise HTTPException(
                status_code=422,
                detail=f"Недопустимый статус. Допустимые: {STAGE_STATUSES}",
            )
    for field, value in data.items():
        setattr(stage, field, value)
    stage.updated_at = _now()
    await db.commit()
    await db.refresh(stage)
    return stage


@router.delete("/{stage_id}", status_code=204)
async def delete_stage(
    stage_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    stage = await _get_stage_or_404(db, stage_id)
    await db.delete(stage)
    await db.commit()


# ───────────────────────── Привязка позиций ─────────────────────────

@router.patch("/{stage_id}/assign-position", response_model=dict)
async def assign_position(
    stage_id: str,
    body: StagePositionAssign,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Привязывает позицию сметы к этапу ГПР из URL, или открепляет (body.detach=True)."""
    # stage_id берём из URL — проверяем существование
    await _get_stage_or_404(db, stage_id)

    pos = await db.get(EstimatePosition, body.position_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Позиция не найдена")

    # detach=True → открепить; иначе → привязать к stage_id из URL
    pos.stage_id = None if body.detach else stage_id
    await db.commit()
    return {"position_id": body.position_id, "stage_id": pos.stage_id}
