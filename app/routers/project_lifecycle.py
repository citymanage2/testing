import uuid
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project import Project
from app.models.task import Task
from app.models.estimate_item import EstimateItem
from app.models.client_act import ClientKs2Act

router = APIRouter()

# ---------------------------------------------------------------------------
# Stage configuration
# ---------------------------------------------------------------------------

STAGE_LABELS: dict[str, str] = {
    "LEAD": "Лид/Продажа",
    "ESTIMATION": "Осмечивание",
    "OPTIMIZATION": "Оптимизация",
    "APPROVAL": "Согласование КП",
    "EXECUTION": "Реализация",
    "HANDOVER": "Сдача объекта",
    "WARRANTY": "Гарантийный период",
    "CLOSED": "Закрыт",
}

ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "LEAD": ["ESTIMATION"],
    "ESTIMATION": ["OPTIMIZATION", "APPROVAL"],
    "OPTIMIZATION": ["ESTIMATION", "APPROVAL"],
    "APPROVAL": ["EXECUTION", "OPTIMIZATION"],
    "EXECUTION": ["HANDOVER"],
    "HANDOVER": ["WARRANTY"],
    "WARRANTY": ["CLOSED"],
    "CLOSED": [],
}


async def _check_transition_conditions(project, to_stage: str, db: AsyncSession) -> Optional[str]:
    """Returns error message if condition not met, None if OK."""
    if to_stage == "ESTIMATION":
        return None  # always allowed
    if to_stage in ("OPTIMIZATION", "APPROVAL"):
        # Need at least one frozen estimate
        tasks_r = await db.execute(select(Task).where(Task.project_id == project.id))
        tasks = tasks_r.scalars().all()
        frozen = [t for t in tasks if t.estimate_status == "frozen"]
        if not frozen:
            return "Для перехода необходима хотя бы одна замороженная смета"
    if to_stage == "EXECUTION":
        if not getattr(project, "project_manager_id", None):
            return "Назначьте руководителя проекта перед переходом в Реализацию"
        # Also require at least one signed estimate
        tasks_r = await db.execute(select(Task).where(Task.project_id == project.id))
        tasks = tasks_r.scalars().all()
        signed = [t for t in tasks if t.estimate_status == "signed"]
        if not signed:
            return "Для перехода в Реализацию необходима хотя бы одна подписанная смета"
    if to_stage == "HANDOVER":
        acts_r = await db.execute(
            select(ClientKs2Act).where(
                ClientKs2Act.project_id == project.id,
                ClientKs2Act.status == "signed"
            )
        )
        if not acts_r.scalars().first():
            return "Для сдачи объекта необходим хотя бы один подписанный акт КС-2"
    return None


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class StageResponse(BaseModel):
    stage: Optional[str]
    stage_label: Optional[str]
    allowed_next_stages: list[str]
    construction_type: Optional[str]
    sales_manager_id: Optional[str]
    project_manager_id: Optional[str]
    contract_number: Optional[str]
    contract_date: Optional[date]

    model_config = {"from_attributes": True}


class StageUpdateRequest(BaseModel):
    stage: str
    reason: Optional[str] = None


class ProjectDetailsUpdate(BaseModel):
    construction_type: Optional[str] = None
    sales_manager_id: Optional[str] = None
    project_manager_id: Optional[str] = None
    contract_number: Optional[str] = None
    contract_date: Optional[date] = None
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ProjectDetailsResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    address: Optional[str]
    construction_type: Optional[str]
    sales_manager_id: Optional[str]
    project_manager_id: Optional[str]
    contract_number: Optional[str]
    contract_date: Optional[date]
    start_date: Optional[date]
    end_date: Optional[date]
    stage: Optional[str]
    stage_label: Optional[str]

    model_config = {"from_attributes": True}


class TimelineEntry(BaseModel):
    stage: str
    stage_label: str
    timestamp: Optional[datetime]
    reason: Optional[str]


class TimelineResponse(BaseModel):
    current_stage: Optional[str]
    current_stage_label: Optional[str]
    history: list[TimelineEntry]


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


def _stage_response(project: Project) -> StageResponse:
    stage = getattr(project, "stage", None)
    allowed = ALLOWED_TRANSITIONS.get(stage, []) if stage else []
    return StageResponse(
        stage=stage,
        stage_label=STAGE_LABELS.get(stage) if stage else None,
        allowed_next_stages=allowed,
        construction_type=getattr(project, "construction_type", None),
        sales_manager_id=getattr(project, "sales_manager_id", None),
        project_manager_id=getattr(project, "project_manager_id", None),
        contract_number=getattr(project, "contract_number", None),
        contract_date=getattr(project, "contract_date", None),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{project_id}/stage", response_model=StageResponse)
async def get_project_stage(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project_owned(project_id, current_user.id, db)
    return _stage_response(project)


@router.post("/{project_id}/stage", response_model=StageResponse)
async def update_project_stage(
    project_id: str,
    body: StageUpdateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project_owned(project_id, current_user.id, db)

    if body.stage not in STAGE_LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown stage: {body.stage}")

    current_stage = getattr(project, "stage", None)
    allowed = ALLOWED_TRANSITIONS.get(current_stage, []) if current_stage else list(STAGE_LABELS.keys())

    if body.stage not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transition from {current_stage!r} to {body.stage!r} is not allowed. "
                   f"Allowed: {allowed}",
        )

    condition_error = await _check_transition_conditions(project, body.stage, db)
    if condition_error:
        raise HTTPException(status_code=400, detail=condition_error)

    if hasattr(project, "stage"):
        project.stage = body.stage
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)

    # Notify project manager if assigned
    pm_id = getattr(project, "project_manager_id", None)
    if pm_id and pm_id != current_user.id:
        from app.models.notification import Notification
        notif = Notification(
            id=str(uuid.uuid4()),
            user_id=pm_id,
            type="stage_change",
            title=f"Проект перешёл на стадию: {STAGE_LABELS.get(body.stage, body.stage)}",
            body=body.reason or "",
            reference_type="project",
            reference_id=project_id,
        )
        db.add(notif)
        await db.commit()

    return _stage_response(project)


@router.patch("/{project_id}/details", response_model=ProjectDetailsResponse)
async def update_project_details(
    project_id: str,
    body: ProjectDetailsUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project_owned(project_id, current_user.id, db)

    update_fields = body.model_dump(exclude_none=True)
    for field, value in update_fields.items():
        if hasattr(project, field):
            setattr(project, field, value)

    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)

    stage = getattr(project, "stage", None)
    return ProjectDetailsResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        address=getattr(project, "address", None),
        construction_type=getattr(project, "construction_type", None),
        sales_manager_id=getattr(project, "sales_manager_id", None),
        project_manager_id=getattr(project, "project_manager_id", None),
        contract_number=getattr(project, "contract_number", None),
        contract_date=getattr(project, "contract_date", None),
        start_date=getattr(project, "start_date", None),
        end_date=getattr(project, "end_date", None),
        stage=stage,
        stage_label=STAGE_LABELS.get(stage) if stage else None,
    )


@router.get("/{project_id}/timeline", response_model=TimelineResponse)
async def get_project_timeline(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Returns stage timeline. Currently returns current stage only (no audit log yet)."""
    project = await _get_project_owned(project_id, current_user.id, db)
    stage = getattr(project, "stage", None)

    history: list[TimelineEntry] = []
    if stage:
        history.append(
            TimelineEntry(
                stage=stage,
                stage_label=STAGE_LABELS.get(stage, stage),
                timestamp=getattr(project, "updated_at", None),
                reason=None,
            )
        )

    return TimelineResponse(
        current_stage=stage,
        current_stage_label=STAGE_LABELS.get(stage) if stage else None,
        history=history,
    )


@router.get("/{project_id}/stage-suggestions")
async def get_stage_suggestions(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Returns suggested next stages with readiness info."""
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    current_stage = getattr(project, "stage", "LEAD") or "LEAD"
    allowed = ALLOWED_TRANSITIONS.get(current_stage, [])
    suggestions = []
    for stage in allowed:
        error = await _check_transition_conditions(project, stage, db)
        suggestions.append({
            "stage": stage,
            "label": STAGE_LABELS.get(stage, stage),
            "ready": error is None,
            "condition_hint": error or "Условия выполнены",
        })
    return {"current_stage": current_stage, "suggestions": suggestions}
