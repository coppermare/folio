from __future__ import annotations

from takehome.services.llm import (
    Citation,
    DocumentContext,
    extract_sources,
    strip_markers_for_history,
    verify_citations,
)


def _doc(doc_id: str, filename: str, pages: list[str]) -> DocumentContext:
    text = "\n\n".join(f"--- Page {i + 1} ---\n{p}" for i, p in enumerate(pages))
    return DocumentContext(
        id=doc_id,
        filename=filename,
        text=text,
        page_count=len(pages),
        pages=pages,
    )


def test_verify_citations_grounded_single_doc() -> None:
    docs = [_doc("abc123", "lease.pdf", ["section 4.2 rent escalation", "break clause"])]
    citations = [
        Citation(document_id="abc123", page=1, label="§4.2", snippet="rent escalation")
    ]
    valid, confidence = verify_citations(citations, docs)
    assert confidence == "grounded"
    assert len(valid) == 1
    assert valid[0].snippet == "rent escalation"


def test_verify_citations_grounded_same_doc_multiple_pages() -> None:
    """Disambiguation case: three citations to the same doc at different pages."""
    docs = [
        _doc(
            "abc",
            "lease.pdf",
            ["rent escalation", "break clause", "indemnity carve-out"],
        )
    ]
    citations = [
        Citation(document_id="abc", page=1, label="§4.2", snippet="rent"),
        Citation(document_id="abc", page=2, label="§7", snippet="break"),
        Citation(document_id="abc", page=3, label="§9", snippet="indemnity"),
    ]
    valid, confidence = verify_citations(citations, docs)
    assert confidence == "grounded"
    assert [c.page for c in valid] == [1, 2, 3]


def test_verify_citations_partial_unknown_doc_stripped() -> None:
    docs = [_doc("abc", "lease.pdf", ["section 4.2 rent escalation"])]
    citations = [
        Citation(document_id="abc", page=1, label="§4.2", snippet="rent"),
        Citation(document_id="ghost", page=1, label="§99", snippet="not real"),
    ]
    valid, confidence = verify_citations(citations, docs)
    assert confidence == "partial"
    assert len(valid) == 1
    assert valid[0].document_id == "abc"


def test_verify_citations_partial_page_out_of_range() -> None:
    docs = [_doc("abc", "lease.pdf", ["page one"])]
    citations = [
        Citation(document_id="abc", page=1, label="", snippet="page one"),
        Citation(document_id="abc", page=99, label="", snippet="invented"),
    ]
    valid, confidence = verify_citations(citations, docs)
    assert confidence == "partial"
    assert len(valid) == 1


def test_verify_citations_ungrounded_empty_documents() -> None:
    citations = [Citation(document_id="abc", page=1, label="", snippet="anything")]
    valid, confidence = verify_citations(citations, [])
    assert confidence == "ungrounded"
    assert valid == []


def test_verify_citations_ungrounded_zero_valid_after_stripping() -> None:
    docs = [_doc("abc", "lease.pdf", ["only page"])]
    citations = [
        Citation(document_id="ghost", page=1, label="", snippet=""),
        Citation(document_id="abc", page=99, label="", snippet=""),
    ]
    valid, confidence = verify_citations(citations, docs)
    assert confidence == "ungrounded"
    assert valid == []


def test_verify_citations_page_none_passes_through() -> None:
    """page=None means page-agnostic — bounds check is skipped."""
    docs = [_doc("abc", "lease.pdf", ["something"])]
    citations = [Citation(document_id="abc", page=None, label="", snippet=None)]
    valid, confidence = verify_citations(citations, docs)
    assert confidence == "grounded"
    assert valid[0].page is None


def test_verify_citations_snippet_dropped_when_not_in_page() -> None:
    """Citation kept (page bounds attest) but snippet cleared (no semantic match)."""
    docs = [_doc("abc", "lease.pdf", ["actual page text about rent"])]
    citations = [
        Citation(
            document_id="abc",
            page=1,
            label="§4.2",
            snippet="totally different invented text",
        )
    ]
    valid, confidence = verify_citations(citations, docs)
    assert confidence == "grounded"
    assert valid[0].snippet is None
    assert valid[0].label == "§4.2"


def test_verify_citations_snippet_case_insensitive_match() -> None:
    docs = [_doc("abc", "lease.pdf", ["The TENANT shall pay Rent quarterly"])]
    citations = [
        Citation(document_id="abc", page=1, label="", snippet="tenant shall pay rent")
    ]
    valid, _ = verify_citations(citations, docs)
    assert valid[0].snippet == "tenant shall pay rent"


def test_strip_markers_for_history_handles_both_forms() -> None:
    prose = "Rent escalates [cite:0]. The break clause [doc:abc123] is at year 5 [cite:1]."
    cleaned = strip_markers_for_history(prose)
    assert "[cite:" not in cleaned
    assert "[doc:" not in cleaned
    assert "Rent escalates" in cleaned


def test_verify_citations_non_paginated_doc_clears_page() -> None:
    """DOCX/MD have page_count=0; LLM still emits page=1 from its schema.

    The citation should be kept (page-agnostic) rather than stripped.
    """
    docs = [
        DocumentContext(
            id="abc",
            filename="lease.docx",
            text="rent escalation in section 4.2",
            page_count=0,
            pages=["rent escalation in section 4.2"],
        )
    ]
    citations = [Citation(document_id="abc", page=1, label="§4.2", snippet="rent escalation")]
    valid, confidence = verify_citations(citations, docs)
    assert confidence == "grounded"
    assert len(valid) == 1
    assert valid[0].page is None
    assert valid[0].snippet == "rent escalation"
    assert valid[0].label == "§4.2"


def test_verify_citations_non_paginated_snippet_match_against_full_text() -> None:
    """Snippet validation for non-paginated docs uses the full extracted text."""
    docs = [
        DocumentContext(
            id="abc",
            filename="notes.md",
            text="The tenant shall pay rent quarterly in advance",
            page_count=0,
            pages=["The tenant shall pay rent quarterly in advance"],
        )
    ]
    citations = [
        Citation(document_id="abc", page=None, label="", snippet="tenant shall pay rent")
    ]
    valid, _ = verify_citations(citations, docs)
    assert valid[0].snippet == "tenant shall pay rent"


def test_extract_sources_legacy_doc_id_fallback() -> None:
    """Fallback regex still recognises the legacy [doc:ID] form."""
    docs = [_doc("abc123", "lease.pdf", ["page text"])]
    prose = "The rent escalates annually [doc:abc123]."
    citations = extract_sources(prose, docs)
    assert len(citations) == 1
    assert citations[0].document_id == "abc123"
