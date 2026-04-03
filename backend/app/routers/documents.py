from fastapi import APIRouter, Depends, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from ..core.database import get_db
from ..core.dependencies import get_current_user, require_admin
from ..models.user import User
from ..schemas.document import DocumentOut
from ..services import document_service
from ..services.activity_service import log_activity

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=List[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = document_service.list_documents(db)
    return [DocumentOut.model_validate(d) for d in docs]


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    doc = await document_service.upload_document(db, file, title, description or "", current_user)
    log_activity(
        db,
        action="document_uploaded",
        user=current_user,
        resource_type="document",
        resource_id=doc["id"],
        details=f"Uploaded document: {doc['title']} ({doc['filename']})",
    )
    return DocumentOut.model_validate(doc)


@router.get("/{id}", response_model=DocumentOut)
def get_document(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = document_service.get_document(db, id)
    return DocumentOut.model_validate(doc)


@router.delete("/{id}", status_code=204)
def delete_document(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    log_activity(
        db,
        action="document_deleted",
        user=current_user,
        resource_type="document",
        resource_id=id,
    )
    document_service.delete_document(db, id)
    return Response(status_code=204)
