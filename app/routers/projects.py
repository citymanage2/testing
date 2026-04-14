import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser, is_admin, owns_or_admin
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
    TaskExtras, SeparationSheetRequest, EstimateItemCreate, ReorderRequest,
)

router = APIRouter()

LOCKED_ESTIMATE_STATUSES = {"signed"}
LOCKED_PROJECT_STAGES = {"EXECUTION", "HANDOVER", "WARRANTY", "CLOSED"}

# Allowed estimate status transitions (from → to).
# Legacy statuses (uploaded, calculated, optimized, ready) can freely move to any new status.
ESTIMATE_TRANSITION_MAP: dict[str, list[str]] = {
    "draft": ["internal_review"],
    "internal_review": ["draft", "frozen"],
    "frozen": ["internal_review", "signed"],
    "signed": ["frozen", "internal_review"],
    "archived": [],
}
_LEGACY_STATUSES = {"uploaded", "calculated", "optimized", "ready"}

async def _check_estimate_editable(task: Task, db: AsyncSession) -> Optional[str]:
    """Returns error message if estimate is not editable, None if OK."""
    if task.estimate_status in LOCKED_ESTIMATE_STATUSES:
        return "Смета подписана и не может быть изменена"
    # Subcontractor estimates remain editable regardless of project stage
    if getattr(task, "estimate_type", None) == "subcontractor":
        return None
    # Check project stage for non-subcontractor estimates
    if task.project_id:
        from app.models.project import Project
        project = await db.get(Project, task.project_id)
        if project and getattr(project, "stage", None) in LOCKED_PROJECT_STAGES:
            return "Смета заморожена: проект находится на стадии реализации"
    return None


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    project = Project(id=str(uuid.uuid4()), name=body.name, description=body.description, user_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectResponse])
async def list_projects(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    q = select(Project).order_by(Project.updated_at.desc())
    if not is_admin(current_user):
        q = q.where(Project.user_id == current_user.id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(project_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or not owns_or_admin(current_user, project.user_id):
        raise HTTPException(status_code=404, detail="Project not found")
    tasks_result = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = tasks_result.scalars().all()
    return ProjectDetailResponse(
        id=project.id, name=project.name, description=project.description,
        tasks=[TaskInProject(
            id=t.id, task_type=t.task_type, status=t.status,
            estimate_status=t.estimate_status,
            estimate_type=getattr(t, 'estimate_type', None),
            parent_estimate_id=getattr(t, 'parent_estimate_id', None),
            calculation_method=getattr(t, 'calculation_method', None),
            name=t.name, created_at=t.created_at,
        ) for t in tasks],
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, body: ProjectUpdate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or not owns_or_admin(current_user, project.user_id):
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = body.name
    project.description = body.description
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or not owns_or_admin(current_user, project.user_id):
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
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


class EstimateStatusLog(BaseModel):
    status: str
    reason: Optional[str] = None
    user_name: Optional[str] = None
    changed_at: Optional[datetime] = None


@router.post("/estimates/{task_id}/status-log")
async def add_estimate_status_log(
    task_id: str,
    body: EstimateStatusLog,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    from app.models.estimate_item_log import EstimateItemLog
    existing_task = await db.get(Task, task_id)
    if existing_task:
        current_status = existing_task.estimate_status
        # Validate transition unless coming from a legacy status or None
        if current_status not in _LEGACY_STATUSES and current_status is not None:
            allowed = ESTIMATE_TRANSITION_MAP.get(current_status, [])
            if body.status not in allowed:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Недопустимый переход статуса сметы: «{current_status}» → «{body.status}». "
                        f"Допустимые переходы: {allowed or ['нет']}"
                    ),
                )
    log = EstimateItemLog(
        id=str(uuid.uuid4()),
        task_id=task_id,
        item_id=None,
        user_id=current_user.id,
        action="status_change",
        field_name="estimate_status",
        old_value=None,
        new_value=body.status + (f" | {body.reason}" if body.reason else ""),
        changed_at=body.changed_at or datetime.now(timezone.utc),
    )
    db.add(log)
    # Also update task status
    task = await db.get(Task, task_id)
    if task:
        task.estimate_status = body.status
        task.estimate_status_updated_at = datetime.now(timezone.utc)
        task.estimate_status_updated_by = body.user_name or current_user.id
    await db.commit()
    return {"ok": True}


@router.get("/estimates/{task_id}/status-log")
async def get_estimate_status_log(
    task_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    from app.models.estimate_item_log import EstimateItemLog
    result = await db.execute(
        select(EstimateItemLog).where(
            EstimateItemLog.task_id == task_id,
            EstimateItemLog.action == "status_change"
        ).order_by(EstimateItemLog.changed_at.desc())
    )
    logs = result.scalars().all()
    return [
        {
            "id": l.id,
            "new_value": l.new_value,
            "changed_at": l.changed_at,
            "user_id": l.user_id,
        }
        for l in logs
    ]


@router.get("/estimates/{task_id}/items", response_model=EstimateItemsResponse)
async def get_estimate_items(task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.sort_order, EstimateItem.position))
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
    task = await db.get(Task, task_id)
    if task:
        lock_error = await _check_estimate_editable(task, db)
        if lock_error:
            raise HTTPException(status_code=403, detail=lock_error)
    if body.section is not None: item.section = body.section
    if body.name is not None: item.name = body.name
    if body.unit is not None: item.unit = body.unit
    if body.quantity is not None: item.quantity = body.quantity
    if body.work_price is not None: item.work_price = body.work_price
    if body.mat_price is not None: item.mat_price = body.mat_price
    if body.source_url is not None: item.source_url = body.source_url
    if body.comment is not None: item.comment = body.comment
    if body.row_type is not None: item.row_type = body.row_type
    if body.sort_order is not None: item.sort_order = body.sort_order
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
    # Only count SMETA tasks for totals (not TZ, project docs, etc.)
    smeta_types = ("SMETA_FROM_LIST", "SMETA_FROM_TZ", "SMETA_FROM_TZ_PROJECT", "SMETA_FROM_PROJECT",
                   "SMETA_FROM_EDC_PROJECT", "SMETA_FROM_GRAND_PROJECT", "SCAN_TO_EXCEL", "IMPORT_EXCEL")
    tasks = (await db.execute(select(Task).where(Task.project_id == project_id))).scalars().all()
    smeta_tasks = [t for t in tasks if t.task_type in smeta_types]
    task_ids = [t.id for t in smeta_tasks]
    if not task_ids:
        return ProjectTotals(total_work=0, total_mat=0, total=0, total_vat=0, tasks_count=0)

    items = (await db.execute(select(EstimateItem).where(EstimateItem.task_id.in_(task_ids)))).scalars().all()

    # Build lookup: task_id → estimate_type
    type_map = {t.id: (getattr(t, "estimate_type", "main") or "main") for t in smeta_tasks}

    client_tw = client_tm = sub_tw = sub_tm = 0.0
    for i in items:
        est_type = type_map.get(i.task_id, "main")
        wp = i.work_price * i.quantity
        mp = i.mat_price * i.quantity
        if est_type == "subcontractor":
            sub_tw += wp
            sub_tm += mp
        else:
            client_tw += wp
            client_tm += mp

    tw = client_tw + sub_tw
    tm = client_tm + sub_tm
    total = tw + tm
    client_total = client_tw + client_tm
    sub_total = sub_tw + sub_tm

    return ProjectTotals(
        total_work=tw, total_mat=tm, total=total,
        total_vat=total * settings.vat_rate / 100,
        tasks_count=len(smeta_tasks),
        client_total=client_total,
        client_total_work=client_tw,
        client_total_mat=client_tm,
        subcontractor_total=sub_total,
        subcontractor_total_work=sub_tw,
        subcontractor_total_mat=sub_tm,
        profit=client_total - sub_total,
    )


@router.get("/estimates/{task_id}/export")
async def export_estimate(task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db), filter_type: str = Query("all")):
    from app.services.excel_service import build_estimate_excel
    items = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.position))).scalars().all()
    data = build_estimate_excel(items, filter_type)
    names = {"works": "works", "materials": "materials"}
    fname = f"smeta_{names.get(filter_type, 'all')}.xlsx"
    return Response(content=data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.patch("/estimates/{task_id}/type")
async def set_estimate_type(
    task_id: str,
    body: dict,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Устанавливает тип сметы: "main" (клиентская) или "subcontractor".
    Смету подрядчика можно создать ТОЛЬКО если в проекте есть хотя бы одна
    подписанная смета заказчика (Абсолютный запрет №11 ТЗ).
    """
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    new_type = body.get("estimate_type")
    if new_type not in ("main", "subcontractor"):
        raise HTTPException(status_code=400, detail="estimate_type must be 'main' or 'subcontractor'")
    if new_type == "subcontractor" and task.project_id:
        # Абсолютный запрет №11: нужна хотя бы одна подписанная клиентская смета
        tasks_r = await db.execute(select(Task).where(Task.project_id == task.project_id))
        all_tasks = tasks_r.scalars().all()
        signed_client = [
            t for t in all_tasks
            if t.id != task_id
            and getattr(t, "estimate_type", "main") != "subcontractor"
            and t.estimate_status == "signed"
        ]
        if not signed_client:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Нельзя создать смету подрядчика: в проекте нет ни одной "
                    "подписанной сметы с заказчиком. Сначала подпишите смету заказчика."
                ),
            )
    task.estimate_type = new_type
    await db.commit()
    return {"ok": True, "estimate_type": new_type}


@router.patch("/estimates/{task_id}/meta")
async def patch_estimate_meta(
    task_id: str,
    body: dict,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Update parent_estimate_id and/or calculation_method for an estimate."""
    task = await db.get(Task, task_id)
    if not task or not owns_or_admin(current_user, task.user_id):
        raise HTTPException(status_code=404, detail="Task not found")
    if "parent_estimate_id" in body:
        task.parent_estimate_id = body["parent_estimate_id"] or None
    if "calculation_method" in body:
        val = body["calculation_method"]
        if val not in (None, "manual", "ai"):
            raise HTTPException(status_code=400, detail="calculation_method must be 'manual' or 'ai'")
        task.calculation_method = val
    await db.commit()
    return {"ok": True}


@router.post("/{project_id}/import-estimate")
async def import_estimate(
    *,
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    estimate_type: str = "main",
):
    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files allowed")
    if estimate_type not in ("main", "subcontractor"):
        raise HTTPException(status_code=400, detail="estimate_type must be 'main' or 'subcontractor'")
    if estimate_type == "subcontractor":
        tasks_r = await db.execute(select(Task).where(Task.project_id == project_id))
        all_tasks = tasks_r.scalars().all()
        signed_client = [
            t for t in all_tasks
            if getattr(t, "estimate_type", "main") != "subcontractor"
            and t.estimate_status == "signed"
        ]
        if not signed_client:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Нельзя импортировать смету подрядчика: в проекте нет ни одной "
                    "подписанной сметы с заказчиком."
                ),
            )
    data = await file.read()
    from app.services.excel_service import parse_estimate_excel
    rows = parse_estimate_excel(data)
    if not rows:
        raise HTTPException(status_code=400, detail="No items found in file")
    task = Task(
        id=str(uuid.uuid4()), task_type="IMPORT_EXCEL", user_id=current_user.id,
        project_id=project_id, status="completed", estimate_status="draft",
        user_prompt=f"Импорт из {file.filename}", chat_history=[],
        estimate_type=estimate_type,
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


@router.get("/estimates/{task_id}/extras", response_model=TaskExtras)
async def get_extras(task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    e = task.extras or {}
    return TaskExtras(
        overhead_pct=e.get("overhead_pct", 0.0),
        overhead_sum=e.get("overhead_sum", 0.0),
        transport_pct=e.get("transport_pct", 0.0),
        transport_sum=e.get("transport_sum", 0.0),
        contingency_pct=e.get("contingency_pct", 0.0),
        contingency_sum=e.get("contingency_sum", 0.0),
    )


@router.patch("/estimates/{task_id}/extras", response_model=TaskExtras)
async def update_extras(task_id: str, body: TaskExtras, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.extras = body.model_dump()
    await db.commit()
    return body


@router.post("/estimates/{task_id}/items", response_model=EstimateItemSchema, status_code=201)
async def add_estimate_item(task_id: str, body: EstimateItemCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if task:
        lock_error = await _check_estimate_editable(task, db)
        if lock_error:
            raise HTTPException(status_code=403, detail=lock_error)
    existing = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.sort_order.desc(), EstimateItem.position.desc()).limit(1))).scalars().first()
    position = (existing.position + 1) if existing else 0
    max_sort = (existing.sort_order + 1.0) if existing else 0.0
    sort_order = body.sort_order if body.sort_order is not None else max_sort
    item = EstimateItem(
        id=str(uuid.uuid4()), task_id=task_id, position=position,
        section=body.section, type=body.type, name=body.name, unit=body.unit,
        quantity=body.quantity, work_price=body.work_price, mat_price=body.mat_price,
        total=(body.work_price + body.mat_price) * body.quantity,
        row_type=body.row_type, sort_order=sort_order,
    )
    db.add(item)
    await db.commit()
    return EstimateItemSchema.model_validate(item)


@router.post("/estimates/{task_id}/items/reorder")
async def reorder_items(task_id: str, body: ReorderRequest, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Bulk update sort_order for drag-and-drop reordering."""
    for entry in body.items:
        item = await db.get(EstimateItem, entry["id"])
        if item and item.task_id == task_id:
            item.sort_order = float(entry["sort_order"])
    await db.commit()
    return {"ok": True}


@router.get("/estimates/{task_id}/sections")
async def get_sections(task_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Return unique section names for this estimate (for autocomplete/dropdown)."""
    result = await db.execute(
        select(EstimateItem.section).where(EstimateItem.task_id == task_id).distinct()
    )
    sections = [row[0] for row in result.fetchall() if row[0]]
    return {"sections": sections}


@router.post("/estimates/{task_id}/items/batch-delete", status_code=204)
async def batch_delete_items(task_id: str, body: dict, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Delete multiple items by id list."""
    item_ids = body.get("item_ids", [])
    for item_id in item_ids:
        item = await db.get(EstimateItem, item_id)
        if item and item.task_id == task_id:
            await db.delete(item)
    await db.commit()


@router.post("/estimates/{task_id}/items/batch-update")
async def batch_update_items(task_id: str, body: dict, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Batch update section or apply price coefficient to selected items."""
    item_ids = body.get("item_ids", [])
    new_section = body.get("section")
    coefficient = body.get("coefficient")
    for item_id in item_ids:
        item = await db.get(EstimateItem, item_id)
        if not item or item.task_id != task_id:
            continue
        if new_section is not None:
            item.section = new_section
        if coefficient is not None:
            item.work_price = round(item.work_price * coefficient, 2)
            item.mat_price = round(item.mat_price * coefficient, 2)
            item.total = (item.work_price + item.mat_price) * item.quantity
    await db.commit()
    return {"ok": True}


@router.delete("/estimates/{task_id}/items/{item_id}", status_code=204)
async def delete_estimate_item(task_id: str, item_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    item = await db.get(EstimateItem, item_id)
    if not item or item.task_id != task_id:
        raise HTTPException(status_code=404, detail="Item not found")
    task = await db.get(Task, task_id)
    if task:
        lock_error = await _check_estimate_editable(task, db)
        if lock_error:
            raise HTTPException(status_code=403, detail=lock_error)
    await db.delete(item)
    await db.commit()


@router.post("/estimates/{task_id}/separation-sheet")
async def separation_sheet(task_id: str, body: SeparationSheetRequest, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.services.excel_service import build_separation_sheet_excel
    q = select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.position)
    all_items = (await db.execute(q)).scalars().all()
    if body.item_ids:
        items = [i for i in all_items if i.id in set(body.item_ids)]
    else:
        items = list(all_items)
        if body.sections:
            items = [i for i in items if (i.section or "") in body.sections]
    if not body.include_works:
        items = [i for i in items if i.type != "Работа"]
    if not body.include_materials:
        items = [i for i in items if i.type != "Материал"]
    data = build_separation_sheet_excel(items, body.title)
    fname = "separation_sheet.xlsx"
    return Response(content=data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})
