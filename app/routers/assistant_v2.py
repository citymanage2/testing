"""ИИ-ассистент и детерминированные алерты проекта v2.

Endpoints:
  GET  /v2/projects/{project_id}/alerts    — список алертов (детерминированно)
  POST /v2/projects/{project_id}/assistant — вопрос к ИИ-ассистенту
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project_member import ProjectMember
from app.schemas.phase6 import (
    ProjectAlertSchema, ProjectAlertsResponse,
    AssistantRequest, AssistantResponse,
)
from app.services.alert_service import get_project_alerts
from app.services.project_assistant import ask_project_assistant

router = APIRouter()


async def _check_project_access(db: AsyncSession, project_id: str, user_id: str) -> None:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")


@router.get("/projects/{project_id}/alerts", response_model=ProjectAlertsResponse)
async def get_alerts(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Проактивные алерты по проекту — только детерминированная логика, без ИИ.

    Типы алертов:
    - overrun (critical): фактические расходы превысили план.
    - overrun_risk (warning): прогноз выявил риск перерасхода.
    - grp_overdue (warning): просроченные этапы ГПР.
    - estimate_no_cost (warning): сметы в активных статусах без себестоимости.
    - no_price_source (info): позиции с непроверенной ценой.
    """
    await _check_project_access(db, project_id, current_user.id)
    alerts = await get_project_alerts(db, project_id)
    return ProjectAlertsResponse(
        project_id=project_id,
        alerts=[
            ProjectAlertSchema(
                alert_type=a.alert_type,
                severity=a.severity,
                message=a.message,
                data=a.data,
            )
            for a in alerts
        ],
        critical_count=sum(1 for a in alerts if a.severity == "critical"),
        warning_count=sum(1 for a in alerts if a.severity == "warning"),
        info_count=sum(1 for a in alerts if a.severity == "info"),
    )


@router.post("/projects/{project_id}/assistant", response_model=AssistantResponse)
async def ask_assistant(
    project_id: str,
    body: AssistantRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    ИИ-ассистент проекта.

    Контекст собирается детерминированно (SQL/Python), затем передаётся в Claude.
    Ассистент знает о сметах, ГПР, материалах и финансах проекта.
    Параметр module (estimate | grp | warehouse | finance) уточняет модуль,
    в котором работает пользователь.
    """
    await _check_project_access(db, project_id, current_user.id)
    answer = await ask_project_assistant(
        db=db,
        project_id=project_id,
        question=body.question,
        module=body.module,
    )
    return AssistantResponse(answer=answer)
