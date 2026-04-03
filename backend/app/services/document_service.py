import os
import uuid
import io
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile
from typing import List
from ..models.document import Document
from ..models.user import User
from ..core.config import settings
from ..ai.vector_store import get_vector_store

ALLOWED_EXTENSIONS = {".txt", ".pdf"}


def _enrich_document(doc: Document, db: Session) -> dict:
    uploader = db.query(User).filter(User.id == doc.uploaded_by).first()
    return {
        "id": doc.id,
        "title": doc.title,
        "description": doc.description,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "content_preview": doc.content_preview,
        "uploaded_by": doc.uploaded_by,
        "uploaded_by_username": uploader.username if uploader else "unknown",
        "is_indexed": doc.is_indexed,
        "created_at": doc.created_at,
    }


def _extract_text(content_bytes: bytes, filename: str) -> str:
    """Extract plain text from a .txt or .pdf file."""
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(content_bytes))
            parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    parts.append(text)
            return "\n".join(parts)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to extract text from PDF: {exc}",
            )
    else:
        try:
            return content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                return content_bytes.decode("latin-1")
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="Could not decode text file. Use UTF-8 or Latin-1 encoding.",
                )


def list_documents(db: Session) -> List[dict]:
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [_enrich_document(d, db) for d in docs]


async def upload_document(
    db: Session,
    file: UploadFile,
    title: str,
    description: str,
    uploader: User,
) -> dict:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only .txt and .pdf files are allowed",
        )

    content_bytes = await file.read()
    file_size = len(content_bytes)

    if file_size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    content = _extract_text(content_bytes, file.filename or "")

    safe_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    content_preview = content[:500] if len(content) > 500 else content

    doc = Document(
        title=title,
        description=description,
        filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        content=content,
        content_preview=content_preview,
        uploaded_by=uploader.id,
        is_indexed=False,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        vector_store = get_vector_store(settings.VECTOR_STORE_PATH)
        vector_store.add_document(
            doc_id=doc.id,
            title=doc.title,
            content=doc.content,
        )
        doc.is_indexed = True
        db.commit()
        db.refresh(doc)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Failed to index document: %s", exc)

    return _enrich_document(doc, db)


def get_document(db: Session, doc_id: int) -> dict:
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _enrich_document(doc, db)


def delete_document(db: Session, doc_id: int) -> None:
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    vector_store = get_vector_store(settings.VECTOR_STORE_PATH)
    vector_store.remove_document(doc_id)
    db.delete(doc)
    db.commit()
