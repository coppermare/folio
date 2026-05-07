"""Add document_ids to messages

Revision ID: 002_message_document_ids
Revises: 001_initial
Create Date: 2026-05-07 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "002_message_document_ids"
down_revision: str | None = "001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("document_ids", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "document_ids")
