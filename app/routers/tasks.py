import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser, is_admin, owns_or_admin
from app.database import get_db
from app.models.task import Task, TASK_TYPES, ALLOWED_MIME_TYPES
from app.models.task_input_file import TaskInputFile
from app.models.task_result import TaskResult
from app.config import settings
from app.schemas.task import TaskStatusResponse, MessageRequest, TaskResultFile, TaskNameUpdate, TaskDocTypeUpdate

router = APIRouter()


@router.get("", response_model=list[TaskStatusResponse])
async def list_tasks(current_user: CurrentUser, db: AsyncSession = Depends(get_db), no_project: bool = False):
    q = select(Task)
    if not is_admin(current_user):
        q = q.where(Task.user_id == current_user.id)
    if no_project:
        q = q.where(Task.project_id.is_(None))
    q = q.order_by(Task.created_at.desc()).limit(100)
    tasks = (await db.execute(q)).scalars().all()
    return [TaskStatusResponse(
        id=t.id, task_type=t.task_type, status=t.status, name=t.name, doc_type=t.doc_type,
        progress_message=t.progress_message, error_message=t.error_message,
        estimate_status=t.estimate_status, estimate_type=getattr(t, 'estimate_type', None),
        created_at=t.created_at, updated_at=t.updated_at,
    ) for t in tasks]



@router.post("", status_code=201)
async def create_task(
    *,
    task_type: str = Form(...),
    prompt: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if task_type not in TASK_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid task_type: {task_type}")
    if len(files) > settings.max_files_per_request:
        raise HTTPException(status_code=400, detail=f"Max {settings.max_files_per_request} files allowed")

    max_size = settings.max_file_size_mb * 1024 * 1024
    file_data_list = []
    for f in files:
        data = await f.read()
        if len(data) > max_size:
            raise HTTPException(status_code=400, detail=f"{f.filename} exceeds {settings.max_file_size_mb}MB")
        file_data_list.append((f.filename or "file", f.content_type or "application/octet-stream", data))

    task = Task(
        id=str(uuid.uuid4()),
        task_type=task_type,
        user_prompt=prompt,
        user_id=current_user.id,
        estimate_status="uploaded",
        chat_history=[],
    )
    db.add(task)
    await db.flush()

    for idx, (fname, mime, data) in enumerate(file_data_list):
        db.add(TaskInputFile(task_id=task.id, file_index=idx, file_name=fname, mime_type=mime, file_data=data, size_bytes=len(data)))

    await db.commit()

    from app.services.task_processor import task_processor
    asyncio.create_task(task_processor.process(task.id))

    return {"task_id": task.id}


@router.post("/create-manual", status_code=201)
async def create_manual_task(
    body: dict,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Create an empty estimate task for manual editing."""
    import uuid
    from datetime import datetime, timezone
    task = Task(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        task_type="IMPORT_EXCEL",
        status="completed",
        name=body.get("name") or "Новая смета",
        project_id=body.get("project_id"),
        estimate_status="draft",
        estimate_type=body.get("estimate_type") or "main",
        parent_estimate_id=body.get("parent_estimate_id"),
        calculation_method=body.get("calculation_method"),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(task)
    await db.commit()
    return {"task_id": task.id}


@router.get("/{task_id}/status", response_model=TaskStatusResponse)
async def get_status(
    task_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskStatusResponse(
        id=task.id,
        task_type=task.task_type,
        status=task.status,
        name=task.name,
        doc_type=task.doc_type,
        progress_message=task.progress_message,
        error_message=task.error_message,
        estimate_status=task.estimate_status,
        estimate_type=getattr(task, 'estimate_type', None),
        project_id=getattr(task, 'project_id', None),
        calculation_method=getattr(task, 'calculation_method', None),
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.post("/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in ("pending", "processing"):
        raise HTTPException(status_code=400, detail="Cannot cancel in current status")
    task.status = "cancelled"
    await db.commit()
    return {"ok": True}


@router.post("/{task_id}/message")
async def send_message(
    task_id: str,
    body: MessageRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.chat_history = task.chat_history + [{"role": "user", "content": body.content}]
    task.error_message = None
    task.status = "pending"
    await db.commit()
    from app.services.task_processor import task_processor
    asyncio.create_task(task_processor.process(task.id))
    return {"ok": True}


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not owns_or_admin(current_user, task.user_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.delete(task)
    await db.commit()


@router.patch("/{task_id}/name")
async def update_task_name(
    task_id: str,
    body: TaskNameUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.name = body.name
    await db.commit()
    return {"ok": True}


@router.patch("/{task_id}/doc-type")
async def update_task_doc_type(
    task_id: str,
    body: TaskDocTypeUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.doc_type = body.doc_type
    await db.commit()
    return {"ok": True}


@router.get("/{task_id}/sub-distribution")
async def get_sub_distribution(
    task_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Return per-item distribution across existing subcontractor estimates linked to task_id."""
    from app.models.estimate_item import EstimateItem

    source_task = await db.get(Task, task_id)
    if not source_task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not owns_or_admin(current_user, source_task.user_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Get source items
    items_result = await db.execute(
        select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.sort_order)
    )
    source_items = [i for i in items_result.scalars().all() if i.row_type != 'section_header']

    # Get all subcontractor tasks linked to this parent
    sub_tasks_q = select(Task).where(
        Task.parent_estimate_id == task_id,
        Task.estimate_type == "subcontractor",
    )
    if not is_admin(current_user):
        sub_tasks_q = sub_tasks_q.where(Task.user_id == current_user.id)
    sub_tasks_result = await db.execute(sub_tasks_q)
    sub_task_ids = [t.id for t in sub_tasks_result.scalars().all()]

    # Collect quantities from all sub-estimates, matched by item name
    distributed_by_name: dict[str, float] = {}
    if sub_task_ids:
        sub_items_result = await db.execute(
            select(EstimateItem).where(EstimateItem.task_id.in_(sub_task_ids))
        )
        for si in sub_items_result.scalars().all():
            if si.row_type == 'section_header':
                continue
            distributed_by_name[si.name] = distributed_by_name.get(si.name, 0.0) + (si.quantity or 0.0)

    result = []
    for item in source_items:
        total = item.quantity or 0.0
        distributed = distributed_by_name.get(item.name, 0.0)
        remaining = max(0.0, total - distributed)
        result.append({
            "item_id": item.id,
            "name": item.name,
            "unit": item.unit,
            "type": item.type,
            "section": item.section,
            "quantity_total": total,
            "quantity_distributed": distributed,
            "quantity_remaining": remaining,
        })
    return result


@router.post("/{task_id}/copy-as-subcontractor", status_code=201)
async def copy_task_as_subcontractor(
    task_id: str,
    body: dict,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Copy a task's estimate as a subcontractor estimate."""
    import uuid
    from datetime import datetime, timezone
    from app.models.estimate_item import EstimateItem

    source_task = await db.get(Task, task_id)
    if not source_task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not owns_or_admin(current_user, source_task.user_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    include_materials = body.get("include_materials", True)
    item_ids_filter = body.get("item_ids")  # None = copy all; list = copy only these IDs
    item_quantities: dict[str, float] = body.get("item_quantities") or {}  # item_id -> override quantity
    new_name = body.get("name") or f"{source_task.name or 'Смета'} (субподряд)"

    new_task = Task(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        task_type=source_task.task_type,
        status="completed",
        name=new_name,
        project_id=source_task.project_id,
        estimate_status="draft",
        estimate_type="subcontractor",
        parent_estimate_id=body.get("parent_estimate_id") or None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(new_task)
    await db.flush()

    items_result = await db.execute(
        select(EstimateItem).where(EstimateItem.task_id == task_id).order_by(EstimateItem.sort_order)
    )
    source_items = items_result.scalars().all()

    item_ids_set = set(item_ids_filter) if item_ids_filter else None
    for item in source_items:
        if not include_materials and item.type == "Материал":
            continue
        if item_ids_set is not None and item.id not in item_ids_set:
            continue
        override_qty = item_quantities.get(item.id)
        use_quantity = override_qty if override_qty is not None else item.quantity
        if override_qty is not None and item.quantity and item.quantity != 0:
            ratio = use_quantity / item.quantity
            use_total = (item.total or 0) * ratio
        else:
            use_total = item.total
        new_item = EstimateItem(
            id=str(uuid.uuid4()),
            task_id=new_task.id,
            position=item.position,
            section=item.section,
            type=item.type,
            name=item.name,
            unit=item.unit,
            quantity=use_quantity,
            work_price=item.work_price,
            mat_price=item.mat_price,
            total=use_total,
            is_analogue=item.is_analogue,
            is_optimized=item.is_optimized,
            source_url=item.source_url,
            comment=item.comment,
            original_data=item.original_data,
            row_type=item.row_type,
            sort_order=item.sort_order,
            sale_price=item.sale_price,
            position_code=item.position_code,
        )
        db.add(new_item)

    await db.commit()
    return {"task_id": new_task.id}


@router.get("/{task_id}/results", response_model=list[TaskResultFile])
async def get_results(
    task_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TaskResult).where(TaskResult.task_id == task_id))
    return [TaskResultFile(id=r.id, file_name=r.file_name, mime_type=r.mime_type, created_at=r.created_at) for r in result.scalars().all()]
