from __future__ import annotations

import hashlib
import os
import uuid
from dataclasses import dataclass
from typing import Any, cast

import fitz  # type: ignore[import-untyped]  # PyMuPDF has no type stubs
import structlog
from docx import Document as DocxDocument
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from takehome.config import settings
from takehome.db.models import Document

logger = structlog.get_logger()

SUPPORTED_EXTENSIONS = (".pdf", ".md", ".docx")


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
    """Upload and process a document for a conversation.

    Accepts PDF, Markdown (.md), and Word (.docx) files. Multiple documents per
    conversation are allowed. Re-uploading a file with the same SHA-256 hash
    inside the same conversation is a silent no-op that returns the existing
    record with ``duplicate=True``.
    """
    filename = file.filename or ""
    if not filename.lower().endswith(SUPPORTED_EXTENSIONS):
        raise ValueError("Only PDF, Markdown, and Word documents are supported.")

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

    original_filename = file.filename or "document"
    unique_name = f"{uuid.uuid4().hex}_{original_filename}"
    file_path = os.path.join(settings.upload_dir, unique_name)
    os.makedirs(settings.upload_dir, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(content)

    logger.info(
        "Saved uploaded document", filename=original_filename, path=file_path, size=len(content)
    )

    extracted_text = ""
    page_count = 0
    try:
        extracted_text, page_count = _extract_text(file_path, original_filename)
    except Exception:
        logger.exception("Failed to extract text from document", filename=original_filename)
        extracted_text = ""

    logger.info(
        "Extracted text from document",
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


def _extract_text(file_path: str, filename: str) -> tuple[str, int]:
    """Dispatch to the right extractor based on filename extension.

    Returns ``(extracted_text, page_count)``. Non-PDF formats return
    ``page_count = 0`` since the concept doesn't apply.
    """
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return _extract_pdf(file_path)
    if lower.endswith(".md"):
        return _extract_markdown(file_path), 0
    if lower.endswith(".docx"):
        return _extract_docx(file_path), 0
    raise ValueError(f"Unsupported file type: {filename}")


def _extract_pdf(file_path: str) -> tuple[str, int]:
    doc = fitz.open(file_path)
    page_count: int = len(doc)
    pages: list[str] = []
    for page_num in range(page_count):
        page = doc[page_num]
        text = cast(str, page.get_text())  # pyright: ignore[reportUnknownMemberType]
        if text.strip():
            pages.append(f"--- Page {page_num + 1} ---\n{text}")
    doc.close()
    return "\n\n".join(pages), page_count


def _extract_markdown(file_path: str) -> str:
    with open(file_path, encoding="utf-8", errors="replace") as f:
        return f.read()


_DOCX_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _docx_element_text(element: Any) -> str:
    """Concatenate all <w:t> text within an lxml element."""
    return "".join(
        cast(str, node.text) or ""
        for node in element.iter()
        if cast(str, node.tag).endswith("}t")
    )


def _extract_docx(file_path: str) -> str:
    """Walk paragraphs and tables in document order, preserving reading flow."""
    docx = DocxDocument(file_path)
    body = cast(Any, docx.element).body
    parts: list[str] = []
    for block in body.iterchildren():
        tag = cast(str, block.tag).split("}")[-1]
        if tag == "p":
            text = _docx_element_text(block)
            if text.strip():
                parts.append(text)
        elif tag == "tbl":
            for row in block.iter(f"{_DOCX_NS}tr"):
                cells = [
                    _docx_element_text(cell) for cell in row.iter(f"{_DOCX_NS}tc")
                ]
                parts.append("\t".join(cells))
    return "\n".join(parts)


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


async def get_documents_by_ids(session: AsyncSession, document_ids: list[str]) -> list[Document]:
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
