import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel

from app.auth import get_current_user, CurrentUser
from app.database import get_db
from app.models.project import Project
from app.models.project_document import ProjectDocument

router = APIRouter()

# ---------------------------------------------------------------------------
# Category labels
# ---------------------------------------------------------------------------

CATEGORY_LABELS: dict[str, str] = {
    "tz": "Техническое задание",
    "design": "Проектная документация",
    "incoming_estimate": "Входящая смета",
    "tu": "Технические условия",
    "other": "Прочее",
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DocumentResponse(BaseModel):
    id: str
    project_id: str
    category: str
    category_label: Optional[str]
    file_name: str
    mime_type: Optional[str]
    version: int
    status: Optional[str]
    comment: Optional[str]
    uploaded_at: Optional[datetime]
    uploaded_by: Optional[str]

    model_config = {"from_attributes": True}


class DocumentPatchRequest(BaseModel):
    status: Optional[str] = None
    comment: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_project_owned(project_id: str, user_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return project


def _doc_response(doc: ProjectDocument) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        project_id=doc.project_id,
        category=doc.category,
        category_label=CATEGORY_LABELS.get(doc.category),
        file_name=doc.file_name,
        mime_type=getattr(doc, "mime_type", None),
        version=doc.version,
        status=getattr(doc, "status", None),
        comment=getattr(doc, "comment", None),
        uploaded_at=getattr(doc, "uploaded_at", None),
        uploaded_by=getattr(doc, "uploaded_by", None),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{project_id}/documents", response_model=list[DocumentResponse])
async def list_documents(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    category: Optional[str] = Query(None),
):
    await _get_project_owned(project_id, current_user.id, db)

    q = select(ProjectDocument).where(
        and_(
            ProjectDocument.project_id == project_id,
            ProjectDocument.is_latest == True,
        )
    )
    if category:
        q = q.where(ProjectDocument.category == category)

    q = q.order_by(ProjectDocument.category, ProjectDocument.uploaded_at.desc())
    result = await db.execute(q)
    docs = result.scalars().all()
    return [_doc_response(d) for d in docs]


@router.post("/{project_id}/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    project_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    category: str = Form("other"),
    comment: str = Form(""),
):
    await _get_project_owned(project_id, current_user.id, db)

    file_name = file.filename or "upload"
    file_data = await file.read()
    mime_type = file.content_type

    # Find existing latest version with the same filename
    existing_q = select(ProjectDocument).where(
        and_(
            ProjectDocument.project_id == project_id,
            ProjectDocument.file_name == file_name,
            ProjectDocument.is_latest == True,
        )
    )
    existing_result = await db.execute(existing_q)
    existing_doc = existing_result.scalars().first()

    next_version = 1
    if existing_doc:
        next_version = existing_doc.version + 1
        existing_doc.is_latest = False

    new_doc = ProjectDocument(
        id=str(uuid.uuid4()),
        project_id=project_id,
        category=category,
        file_name=file_name,
        mime_type=mime_type,
        file_data=file_data,
        version=next_version,
        is_latest=True,
        status="active",
        comment=comment or None,
        uploaded_at=datetime.now(timezone.utc),
        uploaded_by=current_user.id,
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    return _doc_response(new_doc)


@router.patch("/{project_id}/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(
    project_id: str,
    doc_id: str,
    body: DocumentPatchRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    doc = await db.get(ProjectDocument, doc_id)
    if not doc or doc.project_id != project_id:
        raise HTTPException(status_code=404, detail="Document not found")

    if body.status is not None:
        doc.status = body.status
    if body.comment is not None:
        doc.comment = body.comment

    await db.commit()
    await db.refresh(doc)
    return _doc_response(doc)


@router.get("/{project_id}/documents/{doc_id}/download")
async def download_document(
    project_id: str,
    doc_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    doc = await db.get(ProjectDocument, doc_id)
    if not doc or doc.project_id != project_id:
        raise HTTPException(status_code=404, detail="Document not found")

    file_data = getattr(doc, "file_data", None)
    if not file_data:
        raise HTTPException(status_code=404, detail="File data not found")

    mime_type = getattr(doc, "mime_type", None) or "application/octet-stream"
    return Response(
        content=file_data,
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.file_name}"'},
    )


@router.delete("/{project_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    project_id: str,
    doc_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    doc = await db.get(ProjectDocument, doc_id)
    if not doc or doc.project_id != project_id:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.delete(doc)
    await db.commit()


@router.get("/{project_id}/documents/{doc_id}/history", response_model=list[DocumentResponse])
async def document_history(
    project_id: str,
    doc_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_owned(project_id, current_user.id, db)

    doc = await db.get(ProjectDocument, doc_id)
    if not doc or doc.project_id != project_id:
        raise HTTPException(status_code=404, detail="Document not found")

    q = (
        select(ProjectDocument)
        .where(
            and_(
                ProjectDocument.project_id == project_id,
                ProjectDocument.file_name == doc.file_name,
            )
        )
        .order_by(ProjectDocument.version.desc())
    )
    result = await db.execute(q)
    docs = result.scalars().all()
    return [_doc_response(d) for d in docs]
