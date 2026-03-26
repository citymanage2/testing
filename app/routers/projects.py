import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
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
    EstimateItemsResponse, EstimateItemSchema, EstimateItemUpdate, EstimateStatusUpdate,
    VersionResponse, OptimizeExecuteRequest, ApplyAnalogueRequest,
    MoveTaskRequest, ProjectTotals, PairCheckResult, KPRequestCreate,
)

router = APIRouter()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    project = Project(id=str(uuid.uuid4()), name=body.name, description=body.description, user_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectResponse])
async def list_projects(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.user_id == current_user.id).order_by(Project.updated_at.desc()))
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(project_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks_result = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = tasks_result.scalars().all()
    return ProjectDetailResponse(
        id=project.id, name=project.name, description=project.description,
        tasks=[TaskInProject(id=t.id, task_type=t.task_type, status=t.status, estimate_status=t.estimate_status, created_at=t.created_at) for t in tasks],
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, body: ProjectUpdate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = body.name
    project.description = body.description
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/estimates/{task_id}")
async def assign_task(project_id: str, task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.project_id = project_id
    await db.commit()
    return {"ok": True}


@router.patch("/estimates/{task_id}/status")
async def update_estimate_status(task_id: str, body: EstimateStatusUpdate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.estimate_status = body.status
    task.estimate_status_updated_at = datetime.now(timezone.utc)
    task.estimate_status_updated_by = body.updated_by
    await db.commit()
    return {"ok": True}


@router.get("/estimates/{task_id}/items", response_model=EstimateItemsResponse)
async def get_estimate_items(task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.position))
    items = result.scalars().all()
    total_work = sum(i.work_price * i.quantity for i in items)
    total_mat = sum(i.mat_price * i.quantity for i in items)
    total = total_work + total_mat
    total_vat = total * settings.vat_rate / 100
    return EstimateItemsResponse(
        items=[EstimateItemSchema.model_validate(i) for i in items],
        vat_rate=settings.vat_rate,
        total_work=total_work, total_mat=total_mat, total=total, total_vat=total_vat,
    )


@router.get("/estimates/{task_id}/versions", response_model=list[VersionResponse])
async def get_versions(task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaskVersion).where(TaskVersion.task_id == task_id).order_by(TaskVersion.version_number.desc()))
    return [VersionResponse.model_validate(v) for v in result.scalars().all()]


@router.post("/estimates/{task_id}/versions/{version_id}/restore")
async def restore_version(task_id: str, version_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.services.snapshot_service import snapshot_service
    await snapshot_service.restore_snapshot(db, task_id, version_id)
    return {"ok": True}


@router.post("/estimates/{task_id}/optimize/plan")
async def get_optimization_plan(task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.services.optimization_service import optimization_service
    return await optimization_service.get_optimization_plan(db, task_id)


@router.post("/estimates/{task_id}/optimize/execute")
async def execute_optimization(task_id: str, body: OptimizeExecuteRequest, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.services.optimization_service import optimization_service
    await optimization_service.execute_optimization(db, task_id, body.item_ids)
    return {"ok": True}


@router.post("/estimates/{task_id}/items/{item_id}/find-analogues")
async def find_analogues(task_id: str, item_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.services.analogue_service import analogue_service
    return await analogue_service.find_analogues(db, task_id, item_id)


@router.post("/estimates/{task_id}/items/{item_id}/apply-analogue")
async def apply_analogue(task_id: str, item_id: str, body: ApplyAnalogueRequest, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.services.analogue_service import analogue_service
    await analogue_service.apply_analogue(db, task_id, item_id, body.model_dump())
    return {"ok": True}


@router.post("/estimates/{task_id}/items/{item_id}/revert-analogue")
async def revert_analogue(task_id: str, item_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.services.analogue_service import analogue_service
    await analogue_service.revert_analogue(db, task_id, item_id)
    return {"ok": True}


@router.patch("/estimates/{task_id}/items/{item_id}", response_model=EstimateItemSchema)
async def update_item(task_id: str, item_id: str, body: EstimateItemUpdate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    item = await db.get(EstimateItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if body.section is not None: item.section = body.section
    if body.name is not None: item.name = body.name
    if body.unit is not None: item.unit = body.unit
    if body.quantity is not None: item.quantity = body.quantity
    if body.work_price is not None: item.work_price = body.work_price
    if body.mat_price is not None: item.mat_price = body.mat_price
    if body.source_url is not None: item.source_url = body.source_url
    if body.comment is not None: item.comment = body.comment
    item.total = (item.work_price + item.mat_price) * item.quantity
    await db.commit()
    return EstimateItemSchema.model_validate(item)


@router.post("/estimates/{task_id}/move")
async def move_task(task_id: str, body: MoveTaskRequest, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.project_id = body.project_id if body.project_id else None
    await db.commit()
    return {"ok": True}


@router.get("/{project_id}/totals", response_model=ProjectTotals)
async def project_totals(project_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    tasks = (await db.execute(select(Task).where(Task.project_id == project_id))).scalars().all()
    task_ids = [t.id for t in tasks]
    if not task_ids:
        return ProjectTotals(total_work=0, total_mat=0, total=0, total_vat=0, tasks_count=0)
    items = (await db.execute(select(EstimateItem).where(EstimateItem.task_id.in_(task_ids)))).scalars().all()
    tw = sum(i.work_price * i.quantity for i in items)
    tm = sum(i.mat_price * i.quantity for i in items)
    total = tw + tm
    return ProjectTotals(total_work=tw, total_mat=tm, total=total, total_vat=total * settings.vat_rate / 100, tasks_count=len(task_ids))


@router.get("/estimates/{task_id}/export")
async def export_estimate(task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db), filter_type: str = Query("all")):
    from app.services.excel_service import build_estimate_excel
    items = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.position))).scalars().all()
    data = build_estimate_excel(items, filter_type)
    names = {"works": "works", "materials": "materials"}
    fname = f"smeta_{names.get(filter_type, 'all')}.xlsx"
    return Response(content=data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.post("/{project_id}/import-estimate")
async def import_estimate(*, project_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db), file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files allowed")
    data = await file.read()
    from app.services.excel_service import parse_estimate_excel
    rows = parse_estimate_excel(data)
    if not rows:
        raise HTTPException(status_code=400, detail="No items found in file")
    task = Task(
        id=str(uuid.uuid4()), task_type="IMPORT_EXCEL", user_id=current_user.id,
        project_id=project_id, status="completed", estimate_status="calculated",
        user_prompt=f"Импорт из {file.filename}", chat_history=[],
    )
    db.add(task)
    await db.flush()
    for row in rows:
        wp = float(row.get("work_price", 0))
        mp = float(row.get("mat_price", 0))
        q = float(row.get("quantity", 1))
        db.add(EstimateItem(
            id=str(uuid.uuid4()), task_id=task.id, position=row["position"],
            section=row.get("section", ""), type=row.get("type", "Работа"),
            name=row["name"], unit=row.get("unit", "шт"),
            quantity=q, work_price=wp, mat_price=mp, total=(wp + mp) * q,
            source_url=row.get("source_url"),
        ))
    await db.commit()
    return {"task_id": task.id}


@router.get("/estimates/{task_id}/check-pairs", response_model=PairCheckResult)
async def check_pairs(task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    items = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.position))).scalars().all()
    works = {i.name.lower().strip() for i in items if i.type == "Работа"}
    materials = {i.name.lower().strip() for i in items if i.type == "Материал"}
    # Find materials with no similar work name and vice versa (simple keyword match)
    mat_without = []
    for i in items:
        if i.type != "Материал": continue
        words = set(i.name.lower().split())
        if not any(any(w in wname for w in words if len(w) > 3) for wname in works):
            mat_without.append(i.name)
    work_without = []
    for i in items:
        if i.type != "Работа": continue
        words = set(i.name.lower().split())
        if not any(any(w in mname for w in words if len(w) > 3) for mname in materials):
            work_without.append(i.name)
    ok = not mat_without and not work_without
    summary = "Все позиции имеют пары." if ok else f"Материалов без работ: {len(mat_without)}, работ без материалов: {len(work_without)}"
    return PairCheckResult(ok=ok, materials_without_work=mat_without[:20], works_without_material=work_without[:20], summary=summary)


@router.post("/estimates/{task_id}/kp-request")
async def kp_request(task_id: str, body: KPRequestCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.services.excel_service import build_kp_excel
    q = select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.position)
    items = (await db.execute(q)).scalars().all()
    if body.item_ids:
        items = [i for i in items if i.id in set(body.item_ids)]
    else:
        items = [i for i in items if i.type == "Материал"]
    data = build_kp_excel(items, body.comment)
    return Response(content=data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": 'attachment; filename="kp_request.xlsx"'})
