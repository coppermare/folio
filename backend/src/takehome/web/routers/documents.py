from __future__ import annotations

import os
from datetime import datetime
from pathlib import PurePath

import structlog
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import FileResponse

from takehome.db.models import Document
from takehome.db.session import get_session
from takehome.services.conversation import get_conversation
from takehome.services.document import (
    delete_document,
    get_document,
    list_documents_for_conversation,
    upload_document,
)

logger = structlog.get_logger()

router = APIRouter(tags=["documents"])


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #


class DocumentOut(BaseModel):
    id: str
    conversation_id: str
    filename: str
    page_count: int
    uploaded_at: datetime
    extraction_failed: bool = False

    model_config = {"from_attributes": True}


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #


def _to_out(doc: Document) -> DocumentOut:
    return DocumentOut(
        id=doc.id,
        conversation_id=doc.conversation_id,
        filename=doc.filename,
        page_count=doc.page_count,
        uploaded_at=doc.uploaded_at,
        extraction_failed=doc.extracted_text is None,
    )


@router.post(
    "/api/conversations/{conversation_id}/documents",
    response_model=DocumentOut,
)
async def upload_document_endpoint(
    conversation_id: str,
    file: UploadFile,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> DocumentOut:
    """Upload a document (PDF, DOCX, or Markdown) for a conversation.

    Multiple documents per conversation are supported. If the same file
    (by SHA-256 hash) already exists in this conversation, returns the
    existing record with status 200 and ``X-Duplicate-Upload: true`` so the
    client can show "Already added" instead of treating it as new.
    """
    conversation = await get_conversation(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    try:
        result = await upload_document(session, conversation_id, file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if result.duplicate:
        response.status_code = 200
        response.headers["X-Duplicate-Upload"] = "true"
    else:
        response.status_code = 201
        logger.info(
            "Document uploaded",
            conversation_id=conversation_id,
            document_id=result.document.id,
            filename=result.document.filename,
        )

    return _to_out(result.document)


@router.get(
    "/api/conversations/{conversation_id}/documents",
    response_model=list[DocumentOut],
)
async def list_documents_endpoint(
    conversation_id: str,
    session: AsyncSession = Depends(get_session),
) -> list[DocumentOut]:
    """List all documents in a conversation, oldest first."""
    conversation = await get_conversation(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    documents = await list_documents_for_conversation(session, conversation_id)
    return [_to_out(d) for d in documents]


_CONTENT_TYPES: dict[str, str] = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".md": "text/markdown; charset=utf-8",
}


def _media_type_for(filename: str) -> str:
    suffix = PurePath(filename).suffix.lower()
    return _CONTENT_TYPES.get(suffix, "application/octet-stream")


@router.get("/api/documents/{document_id}/content")
async def serve_document_file(
    document_id: str,
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    """Serve the raw uploaded file for download/viewing."""
    document = await get_document(session, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=document.file_path,
        filename=document.filename,
        media_type=_media_type_for(document.filename),
    )


@router.delete("/api/documents/{document_id}", status_code=204)
async def delete_document_endpoint(
    document_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a document, including the underlying file on disk."""
    deleted = await delete_document(session, document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    logger.info("Document deleted", document_id=document_id)
