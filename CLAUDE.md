# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Document Q&A for commercial real estate lawyers. Users upload legal PDFs (leases, title reports, environmental assessments) into a conversation and ask questions about them; the AI answers grounded in the documents and cites which ones it used.

Design rationale for user-facing behaviour is documented in `DECISIONS.md` — read it before changing user-facing behaviour.

## Running it

Everything lives in Docker. Day-to-day commands go through `just` (see `justfile` for the full list):

```
just dev          # full stack (db + backend + frontend) with hot reload
just stop         # stop containers
just reset        # stop + drop pgdata volume
just check        # backend ruff + pyright AND frontend biome + tsc
just fmt          # ruff format + biome format
just db-shell     # psql shell into the running db
```

Migrations run automatically on backend startup via the FastAPI `lifespan` (see `backend/src/takehome/web/app.py`). You don't normally need `just db-init` — it exists for cases where the backend isn't running.

### Inside-container commands

Most one-off backend commands need `docker compose exec backend ...`:

```
docker compose exec backend uv run alembic revision -m "msg"          # new migration
docker compose exec backend uv run alembic upgrade head               # apply
docker compose exec backend uv run alembic downgrade <revision>       # roll back
docker compose exec backend uv run pytest backend/tests/test_x.py     # single test file
docker compose exec backend uv run pytest -k name_substring           # single test
```

Always verify a migration is **reversible** (downgrade then re-upgrade and confirm DDL parity) before merging.

### Running the frontend outside Docker

`vite.config.ts` reads `VITE_API_PROXY` for the `/api` proxy target:

- Inside Docker (default): `http://backend:8000` — uses Docker's DNS for service `backend`.
- Outside Docker (e.g. when using preview\_start): set `VITE_API_PROXY=http://localhost:8000`. Already wired in `.claude/launch.json`.

If both `db` and `backend` exist but `db` isn't on the `folio_default` network, the backend will hang at "Running database migrations…" — that means `up -d` was run with mismatched project flags. Fix with `docker compose -p folio down` then `docker compose --project-directory <repo> up -d`.

### Watch out: stale docker stacks

If `just dev` fails to bind 5432 / 8000 / 5173, an older Compose stack from a sibling clone of this repo may still be running. List with `docker ps`, then stop the conflicting one with `docker compose -p <project-name> down`.

## Architecture

### Backend

```
backend/src/takehome/
  config.py            Pydantic settings (max_upload_size, anthropic_api_key, …)
  db/models.py         SQLAlchemy ORM (Conversation, Message, Document)
  db/session.py        async session factory
  services/            Business logic — keep web-layer-free
    conversation.py
    document.py        upload, dedup, text extraction (PyMuPDF)
    llm.py             PydanticAI agent + typed Citation/Answer contract
  web/app.py           FastAPI app + CORS + lifespan (runs migrations)
  web/routers/         conversations, messages, documents
alembic/versions/      Migrations — keep them reversible
```

A conversation has many documents and many messages. Multiple docs per conversation are first-class — the original 1-doc-per-conversation rule was removed. Per-conversation hash dedup (SHA-256 over upload bytes, unique on `(conversation_id, content_hash)`) makes re-uploading the same file a silent no-op; the upload endpoint signals this with `200 OK + X-Duplicate-Upload: true` instead of `201 Created`.

### LLM service: the typed contract

`services/llm.py` defines the typed citation contract. It defines:

- `Citation { document_id, page?, label, snippet? }` — one cited reference.
- `Answer { reasoning, sources: list[Citation], prose }` — the structured response shape. Field order matters for streaming UX (reasoning surfaces first, then sources, then prose).
- `chat_with_documents(user_message, documents, history)` — async iterator over a structured stream. Builds the prompt with one `<doc id="…" name="…">…</doc>` block per loaded document and instructs the model to emit `[cite:N]` markers inline, where `N` is a 1-indexed position into `Answer.sources`.
- `extract_sources(prose, documents)` — regex fallback for the unstructured-output path; recognizes the legacy `[doc:ID]` form (the canonical `[cite:N]` form needs the typed `sources` array, which the structured path provides directly).
- `strip_markers_for_history(prose)` — strips both `[cite:N]` and legacy `[doc:ID]` markers before re-feeding history to the LLM and for display.

Prose streams token-by-token (fast UX). The structured path is the primary route — `answer.sources` is authoritative — and `[cite:N]` is just a positional reference into it. The regex fallback exists only for the rare unstructured-output case. **Don't break the `Citation` / `Answer` contract.**

### Streaming protocol

`POST /api/conversations/{id}/messages` returns SSE with these event types (in roughly this order):

- `{"type":"reasoning","delta":"<chunk>"}` — chain-of-thought tokens.
- `{"type":"content","content":"<delta>"}` — prose chunk (may contain raw `[cite:N]` markers).
- `{"type":"source_preview","source":{...}}` — early citation hint; may interleave with `content`.
- `{"type":"message","message":{...}}` — final canonical message after streaming ends; `content` has the markers stripped.
- `{"type":"citations","sources":[...]}` — final typed citations.
- `{"type":"done","sources_cited":N}` — terminal event.

The frontend's `useMessages` accumulates `content` chunks into `streamingContent`, then replaces the streaming bubble with the canonical message. Brief flashes of `[cite:N]` mid-stream are acceptable; the canonical message has them stripped server-side.

### Frontend

```
frontend/src/
  App.tsx              composes ChatSidebar | ChatWindow | DocumentViewer
  types.ts             API DTOs
  lib/api.ts           fetch wrappers — uploadDocument returns {document, duplicate}
  hooks/
    use-conversations.ts
    use-messages.ts    SSE parser + streamingContent
    use-documents.ts   multi-doc state: documents[], activeDocumentId, uploadingCount
  components/
    DocStrip.tsx       chip strip in ChatWindow header
    ChatWindow.tsx     hosts DocStrip + drag-anywhere upload overlay
    DocumentViewer.tsx PDF viewer; secondary <select> dropdown when 2+ docs
    MessageBubble.tsx  per-message attribution + citation pills
    EmptyState.tsx     full-bleed first-upload tile
    ChatInput.tsx      textarea + send (no paperclip — upload via drag or DocStrip)
```

UI rule: **uploading a document does NOT auto-switch the viewer.** Append to the chip strip; user keeps their place. Citation-pill → viewer-jump is handled via the citation click flow.

## Conventions

- Python: ruff (`select = ["E","W","F","I","B","C4","UP"]`, line-length 100), pyright in strict mode. Run via `just check-backend`.
- Frontend: biome + tsc. Run via `just check-frontend`.
- Comments only for non-obvious *why*. Avoid narrating *what* the code already says (see existing services and routers — they have very few comments by design).
- When changing user-visible behaviour, capture the *why* in `DECISIONS.md`. Commit messages and PR descriptions stay terse.
