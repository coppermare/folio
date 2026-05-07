from __future__ import annotations

import hashlib
import os
import uuid
from dataclasses import dataclass

import fitz  # PyMuPDF
import structlog
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from takehome.config import settings
from takehome.db.models import Document

logger = structlog.get_logger()


@dataclass
class UploadResult:
    """Result of an upload attempt.

    ``duplicate`` is True when the same content (by hash) already exists in the
    conversation — the caller can surface a "Already added" toast and the
    document field points to the pre-existing row (no re-extraction).
    """

    document: Document
    duplicate: bool


async def upload_document(
    session: AsyncSession, conversation_id: str, file: UploadFile
) -> UploadResult:
    """Upload and process a PDF document for a conversation.

    Multiple documents per conversation are allowed. Re-uploading a file with the
    same SHA-256 hash inside the same conversation is a silent no-op that
    returns the existing record with ``duplicate=True``.
    """
    if file.content_type not in ("application/pdf", "application/x-pdf"):
        filename = file.filename or ""
        if not filename.lower().endswith(".pdf"):
            raise ValueError("Only PDF files are supported.")

    content = await file.read()

    if len(content) > settings.max_upload_size:
        raise ValueError(
            f"File too large. Maximum size is {settings.max_upload_size // (1024 * 1024)}MB."
        )

    content_hash = hashlib.sha256(content).hexdigest()

    existing = await _get_by_conversation_and_hash(session, conversation_id, content_hash)
    if existing is not None:
        logger.info(
            "Skipping duplicate upload",
            conversation_id=conversation_id,
            document_id=existing.id,
            content_hash=content_hash,
        )
        return UploadResult(document=existing, duplicate=True)

    original_filename = file.filename or "document.pdf"
    unique_name = f"{uuid.uuid4().hex}_{original_filename}"
    file_path = os.path.join(settings.upload_dir, unique_name)
    os.makedirs(settings.upload_dir, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(content)

    logger.info(
        "Saved uploaded PDF", filename=original_filename, path=file_path, size=len(content)
    )

    extracted_text = ""
    page_count = 0
    try:
        doc = fitz.open(file_path)
        page_count = len(doc)
        pages: list[str] = []
        for page_num in range(page_count):
            page = doc[page_num]
            text = page.get_text()  # type: ignore[union-attr]
            if text.strip():
                pages.append(f"--- Page {page_num + 1} ---\n{text}")
        extracted_text = "\n\n".join(pages)
        doc.close()
    except Exception:
        logger.exception("Failed to extract text from PDF", filename=original_filename)
        extracted_text = ""

    logger.info(
        "Extracted text from PDF",
        filename=original_filename,
        page_count=page_count,
        text_length=len(extracted_text),
    )

    document = Document(
        conversation_id=conversation_id,
        filename=original_filename,
        file_path=file_path,
        extracted_text=extracted_text if extracted_text else None,
        page_count=page_count,
        content_hash=content_hash,
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)
    return UploadResult(document=document, duplicate=False)


async def get_document(session: AsyncSession, document_id: str) -> Document | None:
    stmt = select(Document).where(Document.id == document_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_documents_for_conversation(
    session: AsyncSession, conversation_id: str
) -> list[Document]:
    """List all documents for a conversation, ordered by upload time."""
    stmt = (
        select(Document)
        .where(Document.conversation_id == conversation_id)
        .order_by(Document.uploaded_at.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def _get_by_conversation_and_hash(
    session: AsyncSession, conversation_id: str, content_hash: str
) -> Document | None:
    stmt = select(Document).where(
        Document.conversation_id == conversation_id,
        Document.content_hash == content_hash,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_documents_by_ids(
    session: AsyncSession, document_ids: list[str]
) -> list[Document]:
    """Fetch a list of documents by their ids, preserving the input ordering."""
    if not document_ids:
        return []
    stmt = select(Document).where(Document.id.in_(document_ids))
    result = await session.execute(stmt)
    docs = list(result.scalars().all())
    by_id = {d.id: d for d in docs}
    return [by_id[doc_id] for doc_id in document_ids if doc_id in by_id]


async def delete_document(session: AsyncSession, document_id: str) -> bool:
    """Delete a document and remove its file from disk. Returns True if it existed."""
    document = await get_document(session, document_id)
    if document is None:
        return False
    file_path = document.file_path
    await session.delete(document)
    await session.commit()
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
    except OSError:
        logger.exception("Failed to remove file from disk", path=file_path)
    return True
