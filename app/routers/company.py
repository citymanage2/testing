from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from fastapi.responses import Response as FastAPIResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.company import CompanySettings

router = APIRouter()

ALLOWED_LOGO_MIME = {"image/png", "image/jpeg", "image/webp"}
MAX_LOGO_BYTES = 512 * 1024


class CompanySettingsIn(BaseModel):
    name: str = ""
    inn: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    address: Optional[str] = None


class CompanySettingsOut(BaseModel):
    id: str
    name: str
    inn: Optional[str]
    kpp: Optional[str]
    ogrn: Optional[str]
    address: Optional[str]
    has_logo: bool
    updated_at: datetime


@router.get("/settings", response_model=CompanySettingsOut)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(CompanySettings).where(CompanySettings.user_id == current_user.id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Not configured")
    return CompanySettingsOut(
        id=row.id, name=row.name, inn=row.inn, kpp=row.kpp, ogrn=row.ogrn,
        address=row.address, has_logo=row.logo_data is not None, updated_at=row.updated_at,
    )


@router.put("/settings", response_model=CompanySettingsOut)
async def upsert_settings(
    body: CompanySettingsIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(CompanySettings).where(CompanySettings.user_id == current_user.id))).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row:
        row.name = body.name
        row.inn = body.inn
        row.kpp = body.kpp
        row.ogrn = body.ogrn
        row.address = body.address
        row.updated_at = now
    else:
        row = CompanySettings(
            id=str(uuid.uuid4()), user_id=current_user.id,
            name=body.name, inn=body.inn, kpp=body.kpp, ogrn=body.ogrn,
            address=body.address, updated_at=now,
        )
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return CompanySettingsOut(
        id=row.id, name=row.name, inn=row.inn, kpp=row.kpp, ogrn=row.ogrn,
        address=row.address, has_logo=row.logo_data is not None, updated_at=row.updated_at,
    )


@router.post("/settings/logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_LOGO_MIME:
        raise HTTPException(status_code=400, detail="Только PNG/JPEG/WebP")
    data = await file.read()
    if len(data) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=400, detail="Максимальный размер лого — 512KB")

    row = (await db.execute(select(CompanySettings).where(CompanySettings.user_id == current_user.id))).scalar_one_or_none()
    if not row:
        row = CompanySettings(id=str(uuid.uuid4()), user_id=current_user.id, name="")
        db.add(row)
    row.logo_data = data
    row.logo_mime = file.content_type
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.get("/settings/logo")
async def get_logo(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(CompanySettings).where(CompanySettings.user_id == current_user.id))).scalar_one_or_none()
    if not row or not row.logo_data:
        raise HTTPException(status_code=404, detail="Лого не загружено")
    return FastAPIResponse(content=row.logo_data, media_type=row.logo_mime or "image/png")
