import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update
from pydantic import BaseModel

from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.notification import Notification

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: Optional[str]
    reference_type: Optional[str]
    reference_id: Optional[str]
    is_read: bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class NotificationCreate(BaseModel):
    user_id: str
    type: str
    title: str
    body: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None


class ReadAllResponse(BaseModel):
    marked: int


class UnreadCountResponse(BaseModel):
    count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    is_read: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if is_read is not None:
        q = q.where(Notification.is_read == is_read)
    q = q.order_by(Notification.created_at.desc()).limit(limit)

    result = await db.execute(q)
    notifications = result.scalars().all()
    return [
        NotificationResponse(
            id=n.id,
            user_id=n.user_id,
            type=n.type,
            title=n.title,
            body=getattr(n, "body", None),
            reference_type=getattr(n, "reference_type", None),
            reference_id=getattr(n, "reference_id", None),
            is_read=n.is_read,
            created_at=getattr(n, "created_at", None),
        )
        for n in notifications
    ]


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count()).where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False,
            )
        )
    )
    count = result.scalar() or 0
    return UnreadCountResponse(count=count)


@router.post("/notifications/read-all", response_model=ReadAllResponse)
async def mark_all_read(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # Fetch unread notifications for the user
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False,
            )
        )
    )
    notifications = result.scalars().all()
    count = len(notifications)

    for n in notifications:
        n.is_read = True

    await db.commit()
    return ReadAllResponse(marked=count)


@router.patch("/notifications/{notif_id}/read", response_model=NotificationResponse)
async def mark_one_read(
    notif_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    notif = await db.get(Notification, notif_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return NotificationResponse(
        id=notif.id,
        user_id=notif.user_id,
        type=notif.type,
        title=notif.title,
        body=getattr(notif, "body", None),
        reference_type=getattr(notif, "reference_type", None),
        reference_id=getattr(notif, "reference_id", None),
        is_read=notif.is_read,
        created_at=getattr(notif, "created_at", None),
    )


@router.delete("/notifications/{notif_id}", status_code=204)
async def delete_notification(
    notif_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    notif = await db.get(Notification, notif_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(notif)
    await db.commit()


@router.post("/notifications", response_model=NotificationResponse, status_code=201)
async def create_notification(
    body: NotificationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Internal helper endpoint — no auth required. Used by other routers to send notifications."""
    notif = Notification(
        id=str(uuid.uuid4()),
        user_id=body.user_id,
        type=body.type,
        title=body.title,
        body=body.body,
        reference_type=body.reference_type,
        reference_id=body.reference_id,
        is_read=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return NotificationResponse(
        id=notif.id,
        user_id=notif.user_id,
        type=notif.type,
        title=notif.title,
        body=getattr(notif, "body", None),
        reference_type=getattr(notif, "reference_type", None),
        reference_id=getattr(notif, "reference_id", None),
        is_read=notif.is_read,
        created_at=getattr(notif, "created_at", None),
    )
