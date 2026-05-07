from __future__ import annotations

import re
from collections.abc import AsyncIterator
from dataclasses import dataclass

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from takehome.config import settings  # noqa: F401 — triggers ANTHROPIC_API_KEY export

# --------------------------------------------------------------------------- #
# Typed output contract (foundation for K-117 grounded citations)
# --------------------------------------------------------------------------- #


class Citation(BaseModel):
    """A reference from an answer back to a specific document."""

    document_id: str = Field(description="ID of the cited document")
    label: str = Field(
        description="Human-readable locator: section, clause, page, etc.",
        default="",
    )


class Answer(BaseModel):
    """An assistant answer with grounded citations.

    The shape is the contract K-117 layers richer citations on top of. K-116
    populates ``sources`` from ``[doc:ID]``-style markers the model emits while
    streaming prose; K-117 will replace that with true structured output.
    """

    prose: str
    sources: list[Citation] = Field(default_factory=list)


@dataclass
class DocumentContext:
    id: str
    filename: str
    text: str | None


# --------------------------------------------------------------------------- #
# Agents
# --------------------------------------------------------------------------- #


SYSTEM_PROMPT = (
    "You are a helpful legal document assistant for commercial real estate "
    "lawyers. You help lawyers review and understand documents during due "
    "diligence.\n\n"
    "IMPORTANT INSTRUCTIONS:\n"
    "- Answer questions based on the document content provided in <doc> blocks.\n"
    "- When you draw on a specific document, cite it inline using the marker "
    "  [doc:DOCUMENT_ID] immediately after the claim. Use the id from the "
    "  <doc id=\"…\"> tag exactly. Use one marker per supporting reference; "
    "  it is fine to combine multiple markers (e.g. [doc:abc][doc:xyz]).\n"
    "- Where helpful, also reference the section, clause, or page in prose "
    "  (e.g. \"Section 4.2\", \"Page 12\").\n"
    "- If the answer is not in any document, say so clearly. Do not fabricate.\n"
    "- Be concise and precise. Lawyers value accuracy over verbosity.\n\n"
    "FORMATTING RULES (strict):\n"
    "- Write in short, well-spaced paragraphs and bullet lists. Default to flowing prose; use bullets only when listing distinct items.\n"
    "- Use Markdown for emphasis (**bold**, *italic*) and short headings (## or ###) when sections truly help.\n"
    "- DO NOT use Markdown tables or any pipe-delimited (`|`) formatting. Never produce rows like `| col | col |`.\n"
    "- DO NOT use ASCII art, separators (---, ===), or decorative characters.\n"
    "- DO NOT prefix bullets with extra symbols beyond a single `-` or `•`.\n"
    "- Keep lines reasonably short and avoid trailing whitespace."
)

agent = Agent("anthropic:claude-haiku-4-5-20251001", system_prompt=SYSTEM_PROMPT)


# --------------------------------------------------------------------------- #
# Public functions
# --------------------------------------------------------------------------- #


async def generate_title(user_message: str) -> str:
    """Generate a 3-5 word conversation title from the first user message."""
    result = await agent.run(
        f"Generate a concise 3-5 word title for a conversation that starts with: '{user_message}'. "
        "Return only the title, nothing else."
    )
    title = str(result.output).strip().strip('"').strip("'")
    if len(title) > 100:
        title = title[:97] + "..."
    return title


async def chat_with_documents(
    user_message: str,
    documents: list[DocumentContext],
    conversation_history: list[dict[str, str]],
) -> AsyncIterator[str]:
    """Stream prose chunks for an answer grounded in zero-or-more documents.

    The full prose is also retained internally so :func:`extract_sources` can
    derive structured ``Citation`` records from inline ``[doc:ID]`` markers
    after streaming completes. The router calls ``extract_sources`` on the
    accumulated full response.
    """
    prompt_parts: list[str] = []

    if documents:
        prompt_parts.append(
            "The following documents are loaded for this conversation. "
            "When you cite, use the id attribute on the surrounding <doc> tag.\n"
        )
        for d in documents:
            text = d.text or "[Text extraction failed for this document — preview only.]"
            prompt_parts.append(f'<doc id="{d.id}" name="{d.filename}">\n{text}\n</doc>\n')
    else:
        prompt_parts.append(
            "No documents have been uploaded yet. If the user asks about a "
            "document, let them know they need to upload one first.\n"
        )

    if conversation_history:
        prompt_parts.append("Previous conversation:\n")
        for msg in conversation_history:
            role = msg["role"]
            content = msg["content"]
            if role == "user":
                prompt_parts.append(f"User: {content}\n")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}\n")
        prompt_parts.append("\n")

    prompt_parts.append(f"User: {user_message}")
    full_prompt = "\n".join(prompt_parts)

    async with agent.run_stream(full_prompt) as result:
        async for text in result.stream_text(delta=True):
            yield text


_DOC_MARKER = re.compile(r"\[doc:([0-9a-fA-F]{4,})(?:\s*[,;:][^\]]*)?\]")
_LOCATOR = re.compile(
    r"(section\s+\d+(?:\.\d+)*|clause\s+\d+(?:\.\d+)*|page\s+\d+|paragraph\s+\d+)",
    re.IGNORECASE,
)


def extract_sources(prose: str, documents: list[DocumentContext]) -> list[Citation]:
    """Pull structured citations out of streamed prose.

    Looks for inline ``[doc:ID]`` markers and pairs each with the nearest
    locator phrase (e.g. "Section 4.2") that appears in the same sentence,
    falling back to the document filename. Unknown ids are dropped silently.
    """
    if not prose or not documents:
        return []

    known: dict[str, DocumentContext] = {d.id: d for d in documents}
    cites: list[Citation] = []
    seen: set[tuple[str, str]] = set()

    for match in _DOC_MARKER.finditer(prose):
        doc_id = match.group(1)
        doc = known.get(doc_id)
        if doc is None:
            continue

        sentence_start = max(prose.rfind(".", 0, match.start()) + 1, 0)
        sentence_end = prose.find(".", match.end())
        if sentence_end == -1:
            sentence_end = len(prose)
        sentence = prose[sentence_start:sentence_end]
        loc_match = _LOCATOR.search(sentence)
        label = loc_match.group(1).strip() if loc_match else doc.filename

        key = (doc_id, label.lower())
        if key in seen:
            continue
        seen.add(key)
        cites.append(Citation(document_id=doc_id, label=label))

    return cites


def strip_citation_markers(prose: str) -> str:
    """Remove ``[doc:ID]`` markers from prose for display."""
    return _DOC_MARKER.sub("", prose)
