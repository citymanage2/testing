"""Участники проекта v2 (роли внутри конкретного объекта)."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project_member import ProjectMember, PROJECT_ROLES
from app.schemas.estimate_v2 import ProjectMemberCreate, ProjectMemberUpdate, ProjectMemberResponse

router = APIRouter()


async def _get_member_or_404(db: AsyncSession, member_id: str) -> ProjectMember:
    m = await db.get(ProjectMember, member_id)
    if not m:
        raise HTTPException(status_code=404, detail="Участник не найден")
    return m


@router.get("", response_model=list[ProjectMemberResponse])
async def list_members(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    rows = (await db.execute(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.created_at)
    )).scalars().all()
    return rows


@router.post("", response_model=ProjectMemberResponse, status_code=201)
async def add_member(
    project_id: str,
    body: ProjectMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if body.role not in PROJECT_ROLES:
        raise HTTPException(status_code=422, detail=f"Роль должна быть одной из: {PROJECT_ROLES}")

    # Проверяем дубликат
    existing = (await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == body.user_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Пользователь уже является участником проекта")

    member = ProjectMember(
        id=str(uuid.uuid4()),
        project_id=project_id,
        user_id=body.user_id,
        role=body.role,
        created_at=datetime.now(timezone.utc),
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.patch("/{member_id}", response_model=ProjectMemberResponse)
async def update_member(
    project_id: str,
    member_id: str,
    body: ProjectMemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    member = await _get_member_or_404(db, member_id)
    if member.project_id != project_id:
        raise HTTPException(status_code=404, detail="Участник не принадлежит этому проекту")

    if body.role not in PROJECT_ROLES:
        raise HTTPException(status_code=422, detail=f"Роль должна быть одной из: {PROJECT_ROLES}")
    member.role = body.role
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=204)
async def remove_member(
    project_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    member = await _get_member_or_404(db, member_id)
    if member.project_id != project_id:
        raise HTTPException(status_code=404, detail="Участник не принадлежит этому проекту")
    await db.delete(member)
    await db.commit()
