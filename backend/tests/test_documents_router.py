from __future__ import annotations

from takehome.web.routers.documents import _media_type_for


def test_media_type_pdf() -> None:
    assert _media_type_for("Lease Agreement.pdf") == "application/pdf"


def test_media_type_docx() -> None:
    assert (
        _media_type_for("Title Report.docx")
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


def test_media_type_markdown() -> None:
    assert _media_type_for("notes.md") == "text/markdown; charset=utf-8"


def test_media_type_case_insensitive() -> None:
    assert _media_type_for("REPORT.PDF") == "application/pdf"
    assert (
        _media_type_for("Memo.DOCX")
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


def test_media_type_unknown_falls_back_to_octet_stream() -> None:
    assert _media_type_for("mystery.bin") == "application/octet-stream"
    assert _media_type_for("no-extension") == "application/octet-stream"
