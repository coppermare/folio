# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Document Q&A for commercial real estate lawyers. Users upload legal PDFs (leases, title reports, environmental assessments) into a conversation and ask questions about them; the AI answers grounded in the documents and cites which ones it used.

Product changes are scoped as Linear issues (e.g. K-115, K-116, K-117). The Linear issue itself carries the design rationale — read it before changing user-facing behaviour.

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

A conversation has many documents and many messages. The 1-doc-per-conversation rule was removed in K-116 — now multiple docs are first-class. Per-conversation hash dedup (SHA-256 over upload bytes, unique on `(conversation_id, content_hash)`) makes re-uploading the same file a silent no-op; the upload endpoint signals this with `200 OK + X-Duplicate-Upload: true` instead of `201 Created`.

### LLM service: the typed contract

`services/llm.py` is the K-117 swap point. It defines:

- `Citation { document_id, label }` — one cited reference.
- `Answer { prose, sources: list[Citation] }` — the structured response shape.
- `chat_with_documents(user_message, documents, history)` — async iterator yielding prose chunks. Builds the prompt with one `<doc id="…" name="…">…</doc>` block per loaded document and instructs the model to emit `[doc:ID]` markers inline.
- `extract_sources(prose, documents)` — regex-parses inline `[doc:ID]` markers into `Citation` records.
- `strip_citation_markers(prose)` — strips the markers for storage/display.

K-116's deliberate tradeoff: prose streams token-by-token (fast UX); citations are extracted post-stream by regex. K-117 will swap that mechanism for true `output_type=Answer` structured streaming without changing the public shape. **Don't break the `Citation` / `Answer` contract** without coordinating with K-117.

### Streaming protocol

`POST /api/conversations/{id}/messages` returns SSE with three event types:

- `{"type":"content","content":"<delta>"}` — prose chunk (may contain raw `[doc:ID]` markers).
- `{"type":"message","message":{...}}` — final canonical message after streaming ends; `content` has the markers stripped.
- `{"type":"done","sources_cited":N,"sources":[...]}` — terminal event with the typed citations.

The frontend's `useMessages` accumulates `content` chunks into `streamingContent`, then replaces the streaming bubble with the canonical message. `MessageBubble` strips markers client-side too, so brief flashes of `[doc:ID]` mid-stream are also cleaned in display.

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
    DocStrip.tsx       chip strip in ChatWindow header (K-116)
    ChatWindow.tsx     hosts DocStrip + drag-anywhere upload overlay
    DocumentViewer.tsx PDF viewer; secondary <select> dropdown when 2+ docs
    MessageBubble.tsx  per-message attribution + citation pills
    EmptyState.tsx     full-bleed first-upload tile
    ChatInput.tsx      textarea + send (paperclip removed in K-116)
```

UI rule (K-116, decision B): **uploading a document does NOT auto-switch the viewer.** Append to the chip strip; user keeps their place. Citation-pill → viewer-jump is K-117's job, not ours.

## Conventions

- Python: ruff (`select = ["E","W","F","I","B","C4","UP"]`, line-length 100), pyright in strict mode. Run via `just check-backend`.
- Frontend: biome + tsc. Run via `just check-frontend`.
- Comments only for non-obvious *why*. Avoid narrating *what* the code already says (see existing services and routers — they have very few comments by design).
- When changing user-visible behaviour, capture the *why* on the Linear issue. Commit messages and PR descriptions stay terse.
