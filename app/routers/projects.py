from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.task import Task
from app.models.project import Project
from app.models.estimate_item import EstimateItem
from app.models.task_version import TaskVersion
from app.config import settings
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse, TaskInProject
from app.schemas.estimate import (
    EstimateItemsResponse, EstimateItemSchema, EstimateStatusUpdate,
    VersionResponse, OptimizeExecuteRequest, ApplyAnalogueRequest
)

router = APIRouter()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(name=body.name, description=body.description, user_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.user_id == current_user.id).order_by(Project.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks_result = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = tasks_result.scalars().all()
    return ProjectDetailResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        tasks=[TaskInProject(
            id=str(t.id), task_type=t.task_type, status=t.status,
            estimate_status=t.estimate_status, created_at=t.created_at
        ) for t in tasks],
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    project.name = body.name
    project.description = body.description
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/estimates/{task_id}")
async def assign_task_to_project(
    project_id: UUID,
    task_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.project_id = project_id
    await db.commit()
    return {"ok": True}


@router.delete("/{project_id}/estimates/{task_id}")
async def remove_task_from_project(
    project_id: UUID,
    task_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.project_id = None
    await db.commit()
    return {"ok": True}


@router.patch("/estimates/{task_id}/status")
async def update_estimate_status(
    task_id: UUID,
    body: EstimateStatusUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.estimate_status = body.status
    task.estimate_status_updated_at = datetime.now(timezone.utc)
    task.estimate_status_updated_by = body.updated_by
    await db.commit()
    return {"ok": True}


@router.get("/estimates/{task_id}/items", response_model=EstimateItemsResponse)
async def get_estimate_items(
    task_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.position)
    )
    items = result.scalars().all()
    total_work = sum(i.work_price * i.quantity for i in items)
    total_mat = sum(i.mat_price * i.quantity for i in items)
    total = total_work + total_mat
    total_vat = total * (1 + settings.vat_rate / 100)
    return EstimateItemsResponse(
        items=[EstimateItemSchema.model_validate(i) for i in items],
        vat_rate=settings.vat_rate,
        total_work=total_work,
        total_mat=total_mat,
        total=total,
        total_vat=total_vat,
    )


@router.get("/estimates/{task_id}/versions", response_model=list[VersionResponse])
async def get_versions(
    task_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TaskVersion).where(TaskVersion.task_id == task_id).order_by(TaskVersion.version_number.desc())
    )
    return result.scalars().all()


@router.post("/estimates/{task_id}/versions/{version_id}/restore")
async def restore_version(
    task_id: UUID,
    version_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.snapshot_service import snapshot_service
    await snapshot_service.restore_snapshot(db, task_id, version_id)
    return {"ok": True}


@router.post("/estimates/{task_id}/optimize/plan")
async def get_optimization_plan(
    task_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.optimization_service import optimization_service
    return await optimization_service.get_optimization_plan(db, task_id)


@router.post("/estimates/{task_id}/optimize/execute")
async def execute_optimization(
    task_id: UUID,
    body: OptimizeExecuteRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.optimization_service import optimization_service
    await optimization_service.execute_optimization(db, task_id, body.item_ids)
    return {"ok": True}


@router.post("/estimates/{task_id}/items/{item_id}/find-analogues")
async def find_analogues(
    task_id: UUID,
    item_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.analogue_service import analogue_service
    return await analogue_service.find_analogues(db, task_id, item_id)


@router.post("/estimates/{task_id}/items/{item_id}/apply-analogue")
async def apply_analogue(
    task_id: UUID,
    item_id: UUID,
    body: ApplyAnalogueRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.analogue_service import analogue_service
    await analogue_service.apply_analogue(db, task_id, item_id, body.model_dump())
    return {"ok": True}


@router.post("/estimates/{task_id}/items/{item_id}/revert-analogue")
async def revert_analogue(
    task_id: UUID,
    item_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.analogue_service import analogue_service
    await analogue_service.revert_analogue(db, task_id, item_id)
    return {"ok": True}
