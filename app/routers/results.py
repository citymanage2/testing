from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.task_result import TaskResult

router = APIRouter()


@router.get("/{file_id}/download")
async def download_result(
    file_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.get(TaskResult, file_id)
    if not result:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(
        content=result.file_data,
        media_type=result.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{result.file_name}"'},
    )
