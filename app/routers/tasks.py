import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.task import Task, TASK_TYPES, ALLOWED_MIME_TYPES
from app.models.task_input_file import TaskInputFile
from app.models.task_result import TaskResult
from app.config import settings
from app.schemas.task import TaskStatusResponse, MessageRequest, TaskResultFile

router = APIRouter()


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
        progress_message=task.progress_message,
        error_message=task.error_message,
        estimate_status=task.estimate_status,
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


@router.get("/{task_id}/results", response_model=list[TaskResultFile])
async def get_results(
    task_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TaskResult).where(TaskResult.task_id == task_id))
    return [TaskResultFile(id=r.id, file_name=r.file_name, mime_type=r.mime_type, created_at=r.created_at) for r in result.scalars().all()]
