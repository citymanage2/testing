"""
Фоновый scheduler для уведомлений гарантийного периода.

Запускается при старте приложения. Раз в 24 часа проверяет:
1. Гарантийные претензии, срок устранения которых истекает через ≤ 30 дней
   → уведомляет менеджера проекта
2. Проекты в стадии WARRANTY, у которых поле end_date через ≤ 30 дней
   → уведомляет менеджера / владельца проекта

ТЗ, раздел 15: «Уведомление за 30 дней до окончания гарантийного периода».
"""

import asyncio
import uuid
import logging
from datetime import date, timedelta

from sqlalchemy import select
from app.database import SessionLocal
from app.models.project import Project
from app.models.warranty_claim import WarrantyClaim
from app.models.notification import Notification

logger = logging.getLogger(__name__)

_INTERVAL_SECONDS = 86_400  # 24 hours
_WARNING_DAYS = 30


async def _run_check() -> None:
    async with SessionLocal() as db:
        today = date.today()
        warning_date = today + timedelta(days=_WARNING_DAYS)

        # ── 1. Гарантийные претензии с приближающимся дедлайном ──────────────
        claims_r = await db.execute(
            select(WarrantyClaim).where(
                WarrantyClaim.status.notin_(["resolved", "closed"]),
                WarrantyClaim.deadline.isnot(None),
                WarrantyClaim.deadline <= warning_date,
                WarrantyClaim.deadline >= today,
            )
        )
        claims = claims_r.scalars().all()

        for claim in claims:
            project = await db.get(Project, claim.project_id)
            if not project:
                continue
            recipient_id = (
                getattr(project, "project_manager_id", None) or project.user_id
            )
            days_left = (claim.deadline - today).days

            # Проверяем, нет ли уже уведомления об этой претензии сегодня
            existing_r = await db.execute(
                select(Notification).where(
                    Notification.reference_id == claim.id,
                    Notification.type == "warranty_claim_deadline",
                    Notification.user_id == recipient_id,
                )
            )
            if existing_r.scalars().first():
                continue

            db.add(
                Notification(
                    id=str(uuid.uuid4()),
                    user_id=recipient_id,
                    type="warranty_claim_deadline",
                    title=(
                        f"Гарантийная претензия истекает через {days_left} дн.: "
                        f"{claim.title[:80]}"
                    ),
                    body=(
                        f"Проект: {project.name}. "
                        f"Срок устранения: {claim.deadline}. "
                        f"Назначен: {claim.assigned_to or 'не назначен'}."
                    ),
                    reference_type="warranty_claim",
                    reference_id=claim.id,
                )
            )

        # ── 2. Проекты на стадии WARRANTY с приближающимся концом ────────────
        projects_r = await db.execute(
            select(Project).where(
                Project.stage == "WARRANTY",
                Project.end_date.isnot(None),
                Project.end_date <= warning_date,
                Project.end_date >= today,
            )
        )
        projects = projects_r.scalars().all()

        for project in projects:
            recipient_id = (
                getattr(project, "project_manager_id", None) or project.user_id
            )
            days_left = (project.end_date - today).days

            existing_r = await db.execute(
                select(Notification).where(
                    Notification.reference_id == project.id,
                    Notification.type == "warranty_period_ending",
                    Notification.user_id == recipient_id,
                )
            )
            if existing_r.scalars().first():
                continue

            db.add(
                Notification(
                    id=str(uuid.uuid4()),
                    user_id=recipient_id,
                    type="warranty_period_ending",
                    title=(
                        f"Гарантийный период проекта заканчивается через {days_left} дн.: "
                        f"{project.name[:60]}"
                    ),
                    body=(
                        f"Проект «{project.name}» находится на стадии Гарантии. "
                        f"Плановая дата окончания: {project.end_date}."
                    ),
                    reference_type="project",
                    reference_id=project.id,
                )
            )

        await db.commit()
        logger.info(
            "Warranty scheduler: checked %d claims, %d projects.",
            len(claims),
            len(projects),
        )


async def warranty_scheduler_loop() -> None:
    """Бесконечный цикл: проверка каждые 24 часа."""
    # Первый запуск через 60 секунд после старта сервера
    await asyncio.sleep(60)
    while True:
        try:
            await _run_check()
        except Exception:
            logger.exception("Warranty scheduler error")
        await asyncio.sleep(_INTERVAL_SECONDS)
