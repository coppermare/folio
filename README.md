# folio

Document Q&A for commercial real estate lawyers. Upload legal documents (leases, title reports, environmental assessments) into a conversation and ask questions about them; the AI answers grounded in the documents and cites which ones it used.

A single conversation can hold many documents.

---

## Setup

### Prerequisites
- Docker and Docker Compose
- [`just`](https://github.com/casey/just) — install via `brew install just` or `cargo install just`

That's it. Everything else runs inside containers.

### Getting started

1. Clone the repo.

2. Run setup:
```
just setup
```
This copies `.env.example` to `.env` and builds the Docker images.

3. Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=your_key_here
```

4. Start everything:
```
just dev
```
Brings up PostgreSQL, the FastAPI backend (port 8000), and the React frontend (port 5173). Database migrations run automatically when the backend starts — no separate step.

5. Open http://localhost:5173.

`backend/src/` and `frontend/src/` are bind-mounted into the containers, so edits hot-reload.

### Sample documents

`sample-docs/` contains three PDFs (commercial lease, title report, environmental assessment) for testing.

### Project structure

- `frontend/` — React (Vite + Tailwind + shadcn/Radix UI)
- `backend/` — FastAPI (Python 3.12 + SQLAlchemy + PydanticAI)
- `alembic/` — database migrations
- `data/` — product analytics and customer feedback used to inform design decisions
- `sample-docs/` — sample PDFs

### Useful commands

- `just dev` — start full stack
- `just stop` — stop services
- `just reset` — stop everything and clear the database
- `just check` — run all linters and type checks
- `just fmt` — format all code
- `just db-init` — run database migrations (rarely needed; happens on backend startup)
- `just db-shell` — open a psql shell
- `just shell-backend` — shell into backend container
- `just logs-backend` — tail backend logs

For architecture, conventions, and non-obvious gotchas see [CLAUDE.md](CLAUDE.md).
