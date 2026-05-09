from __future__ import annotations

import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Literal

import structlog
from pydantic import BaseModel, Field, ValidationError
from pydantic_ai import Agent

from takehome.config import settings as _settings  # noqa: F401 — triggers ANTHROPIC_API_KEY export

_ = _settings  # touch to silence pyright's unused-import check

logger = structlog.get_logger()


# --------------------------------------------------------------------------- #
# Typed output contract
# --------------------------------------------------------------------------- #

ConfidenceState = Literal["grounded", "partial", "ungrounded"]


class Citation(BaseModel):
    """A reference from an answer back to a specific document and page."""

    document_id: str = Field(
        description='ID of the cited document. Use the id attribute from <doc id="…"> exactly.'
    )
    page: int | None = Field(
        default=None,
        description="1-indexed PDF page where the cited content appears, or null if page-agnostic.",
    )
    label: str = Field(
        default="",
        description="Human-readable locator: section, clause, schedule, etc. (e.g. '§4.2', 'Schedule 1').",
    )
    snippet: str | None = Field(
        default=None,
        description="Verbatim ≤200-char excerpt from the cited page that supports the claim.",
    )


class Answer(BaseModel):
    """An assistant answer with grounded inline citations.

    Field order matters — PydanticAI streams JSON in declaration order:
    1. ``reasoning`` first: the model's visible chain-of-thought, surfaced in
       a "Thoughts" panel as it streams.
    2. ``sources`` next: the citation array, available before prose so
       ``[cite:N]`` markers resolve inline the moment prose tokens arrive.
    3. ``prose`` last: the final answer text the user reads.
    """

    reasoning: str = Field(
        default="",
        description=(
            "Your step-by-step thought process before answering. Cover: what the "
            "user is actually asking, which document(s) and section(s) are likely "
            "relevant, key passages you've located, and how you'll structure the "
            "answer. Plain prose, 3-6 short sentences. This is shown to the user "
            "as a transparent reasoning trace — write it for them, not for "
            "yourself, but keep it concise."
        ),
    )
    sources: list[Citation] = Field(default_factory=lambda: [])  # noqa: PIE807
    prose: str = Field(
        description="The answer text. Embed [cite:N] markers inline immediately after each supported claim."
    )


@dataclass
class DocumentContext:
    """A document in the LLM prompt context.

    ``pages`` is the per-page raw text (1-indexed conceptually; ``pages[0]`` is page 1).
    ``page_count`` is the number of pages with extractable text.
    """

    id: str
    filename: str
    text: str | None
    page_count: int = 0
    pages: list[str] = field(default_factory=lambda: [])  # noqa: PIE807


# Tagged event union yielded by chat_with_documents.
# ("reasoning", str)   — visible chain-of-thought delta, shown in Thoughts panel.
# ("content", str)     — prose delta to stream to the client.
# ("source", Citation) — a single citation that just became available.
LlmEvent = (
    tuple[Literal["reasoning"], str]
    | tuple[Literal["content"], str]
    | tuple[Literal["source"], Citation]
)


# --------------------------------------------------------------------------- #
# Agents
# --------------------------------------------------------------------------- #


SYSTEM_PROMPT = (
    "You are a helpful legal document assistant for commercial real estate "
    "lawyers. You help lawyers review and understand documents during due diligence.\n\n"
    "GROUNDING RULES (strict):\n"
    "- Answer questions based on the document content provided in <doc> blocks. "
    "Each <doc> contains content split by '--- Page N ---' separators that mark "
    "page boundaries.\n"
    "- OUTPUT ORDER: emit `reasoning` FIRST (visible chain-of-thought, shown to "
    "the user in a Thoughts panel), then `sources`, then `prose`. This order is "
    "non-negotiable — the streaming UI relies on it for the Thoughts panel and "
    "for inline citation resolution.\n"
    "- REASONING field: 3-6 short sentences explaining what you're doing. Talk "
    "to the user, not to yourself. Cover: what they're really asking, which "
    "section(s) you'll consult, and how you'll structure the answer. Do not "
    "repeat the answer here. If your reasoning notes uncertainty or a gap, "
    "your prose must reflect it — never sound more confident in `prose` than "
    "in `reasoning`.\n"
    "- When you draw on a specific document, cite it INLINE using a [cite:N] "
    "marker placed immediately after the supported claim. N is a 0-indexed "
    "reference into the `sources` array you return.\n"
    "- For each [cite:N] you emit, populate sources[N] with: document_id (from "
    'the <doc id="…"> attribute exactly), page (1-indexed PDF page where the '
    "cited content appears, or null for documents that have no '--- Page N ---' "
    "separators — Markdown and Word documents are not paginated), label (a "
    "human-readable locator like '§4.2', 'Schedule 1', 'Recitals'; empty string "
    "if no obvious locator), and snippet (a verbatim ≤200-char excerpt that "
    "supports the claim).\n"
    "- Use sequential indices starting at 0. If the same passage supports two "
    "sentences, you may reuse the same N (only add it once to sources). If "
    "you refuse under HONESTY RULES because nothing is grounded, return an "
    "empty sources array — do not pad it with tangentially-related citations "
    "to satisfy the schema.\n"
    "- DEICTIC REFERENCES: when documents are loaded and the user says 'this "
    "file', 'this lease', 'this document', 'have a look at this', etc., they "
    "are referring to the document(s) already in your context — never assume "
    "a new file is missing or ask them to upload again. If multiple docs are "
    "loaded and the reference is ambiguous, ask which one they mean — UNLESS "
    "the question is ungrounded across all loaded docs, in which case refuse "
    "per HONESTY RULES rather than asking.\n"
    "- Be concise and precise. Lawyers value accuracy over verbosity.\n\n"
    "HONESTY RULES (strict — these override fluency):\n"
    "- REFUSE WHEN UNGROUNDED. If the central factual claim of your answer "
    "cannot be supported by a [cite:N] from the loaded documents, you MUST "
    "refuse rather than guess. Use one of these patterns:\n"
    "  • 'I don't see [topic] in the loaded documents. The [doc name] covers "
    "[what it does cover], but not [what's missing].'\n"
    "  • 'The loaded documents don't address this. You may need [type of "
    "document — e.g. the SPA, the title plan, an environmental report] to "
    "answer it.'\n"
    "  • 'I cannot answer this from [doc name] alone — the relevant "
    "section appears to be missing or covered in a document not loaded here.'\n"
    "- DOCUMENTED ABSENCE IS NOT A REFUSAL. If the document does address the "
    "topic but answers in the negative (e.g. the lease genuinely grants no "
    "break right, the SPA contains no environmental warranty), say so "
    "positively and cite the relevant section — e.g. 'The lease grants no "
    "break right; §3 sets the term as 10 years with no early-termination "
    "clause.[cite:N]'. Do NOT use 'I don't see…' when the document itself "
    "answers 'no'.\n"
    "- TEXT-EXTRACTION FAILURE. If a <doc> block's body is the literal string "
    "'[Text extraction failed for this document — preview only.]', do not "
    "guess at its contents. Tell the user plainly: 'I cannot read "
    "[filename] — its text did not extract. It may be a scanned PDF; please "
    "re-upload as searchable text.'\n"
    "- PARTIAL COVERAGE. If the answer is only partially in the documents, "
    "cite what is covered AND explicitly name what is not. Do not paper over "
    "gaps with generic legal commentary.\n"
    "- NO FABRICATION. Never invent clause numbers, page numbers, section "
    "labels, defined terms, party names, dates, or monetary figures. If you "
    "would write 'Section 14' or 'page 23' without having located that exact "
    "text in a <doc>, stop and refuse instead. Never invent a document_id.\n"
    "- FLAG SPECULATION. If the user asks for inference beyond the documents "
    "(market practice, general drafting norms), you MAY add ONE short sentence "
    "(or at most two) prefixed with 'Beyond the documents:'. Grounded analysis "
    "with citations must come first; speculation never replaces a refusal, "
    "and never appears without grounded content preceding it. If the entire "
    "answer would be speculative, refuse instead.\n"
    "- Honesty is faster than the lawyer back-checking your work. A clear "
    "'I don't know from these documents' beats a confident-sounding answer "
    "that turns out wrong.\n\n"
    "FORMATTING RULES (strict):\n"
    "- Write in short, well-spaced paragraphs and bullet lists. Default to "
    "flowing prose; use bullets only when listing distinct items.\n"
    "- When you would naturally enumerate '(a) X; (b) Y; (c) Z' or 'first... "
    "second... third...', render as a Markdown bullet list (one '- ' per "
    "item) instead of inline prose. Keep the (a)/(b)/(c) prefix on each "
    "bullet when the source document references those labels — they are "
    "cross-referenced elsewhere.\n"
    "- Use Markdown for emphasis (**bold**, *italic*) and short headings (## "
    "or ###) when sections truly help.\n"
    "- DO NOT use Markdown tables or any pipe-delimited (`|`) formatting.\n"
    "- DO NOT use ASCII art, separators (---, ===), or decorative characters.\n"
    "- DO NOT prefix bullets with extra symbols beyond a single `-` or `•`.\n"
    "- Keep lines reasonably short and avoid trailing whitespace."
)

# Sonnet for chat — higher reliability with structured output on long lease text.
chat_agent = Agent(
    "anthropic:claude-sonnet-4-6",
    output_type=Answer,
    system_prompt=SYSTEM_PROMPT,
)

# Haiku for short-form tasks (title generation).
title_agent = Agent("anthropic:claude-haiku-4-5-20251001")


# --------------------------------------------------------------------------- #
# Public functions
# --------------------------------------------------------------------------- #


async def generate_title(user_message: str) -> str:
    """Generate a 3-5 word conversation title from the first user message."""
    result = await title_agent.run(
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
    *,
    referenced_document_ids: list[str] | None = None,
    user_name: str | None = None,
    result_holder: list[Answer] | None = None,
) -> AsyncIterator[LlmEvent]:
    """Stream prose deltas and citation objects from the structured-output agent.

    Yields ``("content", delta)`` for prose and ``("source", Citation)`` for
    each source object as it becomes available in ``partial.sources``.  Sources
    are emitted as soon as PydanticAI's incremental JSON parser closes each
    source object, so citation pills appear on the client without waiting for
    the full sources array to complete.

    After the stream completes the final validated :class:`Answer` is appended
    to ``result_holder`` if provided.
    """
    prompt_parts: list[str] = []

    if documents:
        prompt_parts.append(
            "The following documents are loaded for this conversation. "
            "When you cite, use the id attribute on the surrounding <doc> tag exactly.\n"
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

    # Per-turn anchor: when the user @-attached files this turn, surface them
    # right next to the user message so deictic phrases ("this file", "have a
    # look at this") resolve to the right document(s).
    referenced_filenames: list[str] = []
    if referenced_document_ids and documents:
        ref_set = set(referenced_document_ids)
        referenced_filenames = [d.filename for d in documents if d.id in ref_set]

    if referenced_filenames:
        names = ", ".join(f'"{n}"' for n in referenced_filenames)
        if len(referenced_filenames) == 1:
            prompt_parts.append(
                f"[Attached this turn: {names}. Resolve 'this file', 'this lease', etc. to it.]\n"
            )
        else:
            prompt_parts.append(
                f"[Attached this turn: {names}. If the user uses a singular "
                f"deictic ('this file') and the reference is unclear across "
                f"these, ask which one they mean.]\n"
            )

    if user_name and user_name.strip():
        prompt_parts.append(
            f"[The user's name is {user_name.strip()}. Do not address them by "
            "name unless they explicitly ask who they are or otherwise reference "
            "their identity.]"
        )

    prompt_parts.append(f"User: {user_message}")
    full_prompt = "\n".join(prompt_parts)

    last_reasoning = ""
    last_prose = ""
    last_sources_count = 0
    try:
        async with chat_agent.run_stream(full_prompt) as run:
            async for partial in run.stream_output(debounce_by=None):
                # Emit reasoning delta (streams first per Answer field order).
                reasoning = partial.reasoning or ""
                if reasoning and reasoning != last_reasoning:
                    if reasoning.startswith(last_reasoning):
                        delta = reasoning[len(last_reasoning) :]
                        if delta:
                            yield ("reasoning", delta)
                    else:
                        yield ("reasoning", reasoning)
                    last_reasoning = reasoning

                prose = partial.prose or ""
                # Emit prose delta.
                if prose and prose != last_prose:
                    if prose.startswith(last_prose):
                        delta = prose[len(last_prose) :]
                        if delta:
                            yield ("content", delta)
                    else:
                        yield ("content", prose)
                    last_prose = prose

                # Emit each newly-completed source object as it arrives.
                current_sources = list(partial.sources or [])
                if len(current_sources) > last_sources_count:
                    for src in current_sources[last_sources_count:]:
                        yield ("source", src)
                    last_sources_count = len(current_sources)

            final = await run.get_output()
        if result_holder is not None:
            result_holder.append(final)
    except ValidationError as exc:
        logger.warning(
            "Structured output validation failed; falling back to ungrounded",
            error=str(exc),
        )
        return


# --------------------------------------------------------------------------- #
# Marker handling — [cite:N] (current) and [doc:ID] (legacy)
# --------------------------------------------------------------------------- #


_CITE_MARKER = re.compile(r"\[cite:(\d+)\]")
_LEGACY_DOC_MARKER = re.compile(r"\[doc:([0-9a-fA-F]{4,})(?:\s*[,;:][^\]]*)?\]")
_LOCATOR = re.compile(
    r"(section\s+\d+(?:\.\d+)*|clause\s+\d+(?:\.\d+)*|page\s+\d+|paragraph\s+\d+)",
    re.IGNORECASE,
)


def extract_sources(prose: str, documents: list[DocumentContext]) -> list[Citation]:
    """Fallback regex extraction when structured output is unavailable.

    Recognises legacy ``[doc:ID]`` markers and produces page-agnostic citations
    keyed by document filename. Used only when the structured-output path fails
    (``ValidationError`` or model regression). New ``[cite:N]`` markers cannot
    be hydrated without a sources array, so they are skipped here — the caller
    will downgrade to ``ungrounded`` if no doc-id markers are recoverable.
    """
    if not prose or not documents:
        return []

    known: dict[str, DocumentContext] = {d.id: d for d in documents}
    cites: list[Citation] = []
    seen: set[tuple[str, str]] = set()

    for match in _LEGACY_DOC_MARKER.finditer(prose):
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
        cites.append(Citation(document_id=doc_id, page=None, label=label, snippet=None))

    return cites


def strip_markers_for_history(prose: str) -> str:
    """Strip both ``[cite:N]`` and legacy ``[doc:ID]`` markers from prose.

    Used when re-injecting prior assistant turns into the LLM context — the
    model should not see (and mimic) stale markers from past turns.
    """
    stripped = _CITE_MARKER.sub("", prose)
    stripped = _LEGACY_DOC_MARKER.sub("", stripped)
    return stripped


# Back-compat alias — the router still imports this name.
strip_citation_markers = strip_markers_for_history


# --------------------------------------------------------------------------- #
# Server-side citation verification
# --------------------------------------------------------------------------- #


def verify_citations(
    citations: list[Citation],
    documents: list[DocumentContext],
) -> tuple[list[Citation], ConfidenceState]:
    """Verify citations against loaded documents and compute confidence state.

    Stripping rules:
    - ``document_id`` not in conversation → strip.
    - ``page`` is not None and outside ``[1, page_count]`` → strip.
      Non-paginated formats (DOCX, Markdown) have ``page_count == 0``; for
      those we treat any page value as page-agnostic and clear it to ``None``
      rather than strip, because the LLM emits ``page=1`` from its schema even
      when the document has no real pages.
    - ``snippet`` is set but not a case-insensitive substring of
      ``pages[page-1]`` → keep the citation but clear the snippet
      (it likely paraphrased; the page bounds passed so the citation
      is still anchored).

    Confidence:
    - ``ungrounded`` — no documents loaded, OR zero valid citations after
      stripping.
    - ``partial`` — at least one valid citation but at least one was stripped.
    - ``grounded`` — at least one valid citation and zero stripped.
    """
    if not documents:
        return [], "ungrounded"

    by_id: dict[str, DocumentContext] = {d.id: d for d in documents}
    valid: list[Citation] = []
    stripped = 0

    for citation in citations:
        doc = by_id.get(citation.document_id)
        if doc is None:
            stripped += 1
            continue

        page = citation.page
        if page is not None:
            if doc.page_count == 0:
                page = None
            elif page < 1 or page > doc.page_count:
                stripped += 1
                continue

        snippet = citation.snippet
        if snippet and doc.page_count == 0 and doc.pages:
            full_text = doc.pages[0]
            if snippet.strip().lower() not in full_text.lower():
                snippet = None
        elif snippet and page is not None and 0 < page <= len(doc.pages):
            page_text = doc.pages[page - 1]
            if snippet.strip().lower() not in page_text.lower():
                snippet = None  # Bounds attest; semantic match did not.

        valid.append(
            Citation(
                document_id=citation.document_id,
                page=page,
                label=citation.label or "",
                snippet=snippet,
            )
        )

    if not valid:
        return [], "ungrounded"
    if stripped > 0:
        return valid, "partial"
    return valid, "grounded"
