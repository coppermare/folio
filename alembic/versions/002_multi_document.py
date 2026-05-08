"""Multi-document conversations — sources JSON + content hash

Revision ID: 002_multi_document
Revises: 001_initial
Create Date: 2026-05-06 00:00:00.000000

Adds the schema needed for multi-doc conversations and grounded citations.

- ``messages.sources``: JSONB array of ``{"document_id": str, "label": str}``
  entries, populated by the typed LLM output. ``sources_cited`` (int) is
  retained as a back-compat counter equal to ``len(sources)``.
- ``documents.content_hash``: SHA-256 of the upload bytes. Combined with a
  unique index on ``(conversation_id, content_hash)`` to make re-uploading
  the same file inside a conversation a silent no-op.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_multi_document"
down_revision: str | None = "001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column(
            "sources",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    op.add_column(
        "documents",
        sa.Column("content_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_documents_conversation_content_hash",
        "documents",
        ["conversation_id", "content_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_documents_conversation_content_hash", table_name="documents")
    op.drop_column("documents", "content_hash")
    op.drop_column("messages", "sources")
