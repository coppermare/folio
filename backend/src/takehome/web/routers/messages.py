from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any, Literal, cast

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from takehome.db.models import Message
from takehome.db.session import get_session
from takehome.services.conversation import get_conversation, update_conversation
from takehome.services.document import (
    get_documents_by_ids,
    list_documents_for_conversation,
)
from takehome.services.llm import (
    Answer,
    Citation,
    ConfidenceState,
    DocumentContext,
    chat_with_documents,
    extract_sources,
    generate_title,
    strip_markers_for_history,
    verify_citations,
)

logger = structlog.get_logger()

router = APIRouter(tags=["messages"])


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    sources_cited: int
    sources: list[dict[str, Any]] | None = None
    confidence: Literal["grounded", "partial", "ungrounded"] = "grounded"
    reasoning: str | None = None
    document_ids: list[str] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str
    document_ids: list[str] | None = None


# --------------------------------------------------------------------------- #
# Source-shape helpers
# --------------------------------------------------------------------------- #


def unwrap_sources(
    raw: list[dict[str, Any]] | dict[str, Any] | None,
) -> tuple[ConfidenceState, list[dict[str, Any]], str | None]:
    """Read ``Message.sources`` JSONB into (confidence, citations, reasoning).

    Two storage shapes are supported:
    - **Current:** ``{"confidence": "...", "citations": [...], "reasoning": "..."}``
    - **Legacy:** bare list ``[{document_id, label}]`` —
      confidence derived from count (empty → ungrounded, non-empty → grounded);
      reasoning unavailable.
    """
    if raw is None:
        return "ungrounded", [], None
    if isinstance(raw, list):
        legacy: list[dict[str, Any]] = raw
        legacy_confidence: ConfidenceState = "grounded" if legacy else "ungrounded"
        return legacy_confidence, legacy, None
    citations_raw: object = raw.get("citations") or []
    citations: list[dict[str, Any]] = (
        cast(list[dict[str, Any]], citations_raw) if isinstance(citations_raw, list) else []
    )
    confidence_raw: object = raw.get("confidence", "ungrounded")
    confidence: ConfidenceState
    if confidence_raw == "grounded":
        confidence = "grounded"
    elif confidence_raw == "partial":
        confidence = "partial"
    else:
        confidence = "ungrounded"
    reasoning_raw: object = raw.get("reasoning")
    reasoning = reasoning_raw if isinstance(reasoning_raw, str) and reasoning_raw else None
    return confidence, citations, reasoning


def _wrap_sources(
    confidence: ConfidenceState,
    citations: list[Citation],
    reasoning: str | None = None,
) -> dict[str, Any] | None:
    """Build the JSONB blob persisted on ``Message.sources``."""
    blob: dict[str, Any] = {
        "confidence": confidence,
        "citations": [c.model_dump() for c in citations],
    }
    if reasoning:
        blob["reasoning"] = reasoning
    return blob


def _to_message_out(m: Message) -> MessageOut:
    confidence, citations, reasoning = unwrap_sources(m.sources)
    return MessageOut(
        id=m.id,
        conversation_id=m.conversation_id,
        role=m.role,
        content=m.content,
        sources_cited=m.sources_cited,
        sources=citations or None,
        confidence=confidence,
        reasoning=reasoning,
        document_ids=m.document_ids,
        created_at=m.created_at,
    )


_PAGE_HEADER = re.compile(r"^--- Page \d+ ---\n", re.MULTILINE)


_HALLUCINATED_NO_FILE = re.compile(
    r"(no\s+(?:new\s+)?(?:file|document|attachment)s?\s+(?:has|have)\s+"
    r"(?:come\s+through|been\s+(?:shared|received|attached|uploaded))"
    r"|please\s+(?:try\s+)?upload(?:ing)?\s+(?:it|the\s+file|again)"
    r"|i\s+(?:can|can't|cannot)\s+(?:see|find)\s+(?:no|any|a)\s+(?:new\s+)?"
    r"(?:file|attachment))",
    re.IGNORECASE,
)


def _filter_hallucinated_history(
    history_messages: list[Message],
) -> list[Message]:
    """Drop assistant turns that hallucinated 'no file came through'.

    A turn is demonstrably wrong when the user message immediately before it
    *did* attach files (``document_ids`` non-empty) but the assistant claimed
    nothing was shared. Feeding those into a fresh prompt biases the model
    toward repeating the same mistake — strip them.
    """
    kept: list[Message] = []
    for i, m in enumerate(history_messages):
        if m.role == "assistant" and i > 0:
            prev = history_messages[i - 1]
            had_attachment = (
                prev.role == "user"
                and prev.document_ids is not None
                and len(prev.document_ids) > 0
            )
            if had_attachment and _HALLUCINATED_NO_FILE.search(m.content):
                continue
        kept.append(m)
    return kept


def _split_pages(extracted_text: str | None) -> list[str]:
    """Split joined ``extracted_text`` back into per-page strings.

    ``services/document.py`` joins extracted pages with ``--- Page N ---``
    headers; this reverses that to populate ``DocumentContext.pages`` without
    re-opening the PDF.
    """
    if not extracted_text:
        return []
    parts = _PAGE_HEADER.split(extracted_text)
    # First segment is the prefix before the first header (usually empty).
    return [p.strip() for p in parts[1:]] if len(parts) > 1 else [extracted_text]


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #


@router.get(
    "/api/conversations/{conversation_id}/messages",
    response_model=list[MessageOut],
)
async def list_messages(
    conversation_id: str,
    session: AsyncSession = Depends(get_session),
) -> list[MessageOut]:
    conversation = await get_conversation(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    result = await session.execute(stmt)
    messages = list(result.scalars().all())

    return [_to_message_out(m) for m in messages]


@router.post("/api/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: MessageCreate,
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Send a user message and stream back the AI response via SSE."""
    conversation = await get_conversation(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=body.content,
        document_ids=body.document_ids or None,
    )
    session.add(user_message)
    await session.commit()
    await session.refresh(user_message)

    logger.info("User message saved", conversation_id=conversation_id, message_id=user_message.id)

    if body.document_ids:
        documents = await get_documents_by_ids(session, body.document_ids)
    else:
        documents = await list_documents_for_conversation(session, conversation_id)

    doc_contexts = [
        DocumentContext(
            id=d.id,
            filename=d.filename,
            text=d.extracted_text,
            page_count=d.page_count or 0,
            pages=_split_pages(d.extracted_text),
        )
        for d in documents
    ]

    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .where(Message.id != user_message.id)
        .order_by(Message.created_at.asc())
    )
    result = await session.execute(stmt)
    history_messages = _filter_hallucinated_history(list(result.scalars().all()))

    # Strip [cite:N] / [doc:ID] markers from prior assistant turns before sending
    # them back into the LLM — model should not see (and mimic) stale markers.
    conversation_history: list[dict[str, str]] = [
        {
            "role": m.role,
            "content": (
                strip_markers_for_history(m.content) if m.role == "assistant" else m.content
            ),
        }
        for m in history_messages
    ]

    user_msg_count = sum(1 for m in history_messages if m.role == "user")
    is_first_message = user_msg_count == 0

    async def event_stream() -> AsyncIterator[str]:
        full_response = ""
        answer_holder: list[Answer] = []

        try:
            async for event in chat_with_documents(
                user_message=body.content,
                documents=doc_contexts,
                conversation_history=conversation_history,
                referenced_document_ids=body.document_ids,
                result_holder=answer_holder,
            ):
                if event[0] == "reasoning":
                    delta: str = event[1]
                    yield f"data: {json.dumps({'type': 'reasoning', 'delta': delta})}\n\n"
                elif event[0] == "content":
                    chunk: str = event[1]
                    full_response += chunk
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
                else:
                    # ("source", Citation) — emit immediately so pills appear in real time.
                    src = event[1]
                    yield f"data: {json.dumps({'type': 'source_preview', 'source': src.model_dump()})}\n\n"

        except Exception:
            logger.exception("Error during LLM streaming", conversation_id=conversation_id)
            error_msg = (
                "I'm sorry, an error occurred while generating a response. Please try again."
            )
            full_response = error_msg
            yield f"data: {json.dumps({'type': 'content', 'content': error_msg})}\n\n"

        # Resolve typed citations + confidence. Prefer the structured Answer;
        # if the model regressed (no Answer or invalid output), fall back to
        # legacy [doc:ID] regex extraction over accumulated prose.
        if answer_holder:
            answer = answer_holder[0]
            stored_prose = answer.prose
            raw_citations = list(answer.sources)
            reasoning_text: str | None = answer.reasoning or None
        else:
            stored_prose = full_response
            raw_citations = extract_sources(full_response, doc_contexts)
            reasoning_text = None

        verified, confidence = verify_citations(raw_citations, doc_contexts)
        stripped_count = max(len(raw_citations) - len(verified), 0)

        sources_payload = _wrap_sources(confidence, verified, reasoning_text)

        from takehome.db.session import async_session as session_factory

        async with session_factory() as save_session:
            assistant_message = Message(
                conversation_id=conversation_id,
                role="assistant",
                # Persist WITH markers so the inline-citation renderer can
                # reconstruct on refetch / page refresh. Markers are stripped
                # only when re-feeding history into the LLM (above).
                content=stored_prose,
                sources_cited=len(verified),
                sources=sources_payload
                if verified or confidence != "grounded" or reasoning_text
                else None,
            )
            save_session.add(assistant_message)
            await save_session.commit()
            await save_session.refresh(assistant_message)

            # Trust-intervention telemetry — measure whether the prompt
            # contract moves the 16.2% ungrounded number across the cohort.
            logger.info(
                "answer_confidence",
                confidence=confidence,
                valid_citations=len(verified),
                stripped_citations=stripped_count,
                conversation_id=conversation_id,
                message_id=assistant_message.id,
            )

            if is_first_message:
                try:
                    title = await generate_title(body.content)
                    await update_conversation(save_session, conversation_id, title)
                    logger.info(
                        "Auto-generated conversation title",
                        conversation_id=conversation_id,
                        title=title,
                    )
                except Exception:
                    logger.exception("Failed to generate title", conversation_id=conversation_id)

            citations_for_wire = [c.model_dump() for c in verified]

            message_data = json.dumps(
                {
                    "type": "message",
                    "message": {
                        "id": assistant_message.id,
                        "conversation_id": assistant_message.conversation_id,
                        "role": assistant_message.role,
                        "content": assistant_message.content,
                        "sources_cited": assistant_message.sources_cited,
                        "sources": citations_for_wire,
                        "confidence": confidence,
                        "reasoning": reasoning_text,
                        "created_at": assistant_message.created_at.isoformat(),
                    },
                }
            )
            yield f"data: {message_data}\n\n"

            citations_event = json.dumps(
                {
                    "type": "citations",
                    "sources": citations_for_wire,
                    "confidence": confidence,
                    "message_id": assistant_message.id,
                }
            )
            yield f"data: {citations_event}\n\n"

            done_data = json.dumps(
                {
                    "type": "done",
                    "sources_cited": len(verified),
                    "sources": citations_for_wire,
                    "confidence": confidence,
                    "message_id": assistant_message.id,
                }
            )
            yield f"data: {done_data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
