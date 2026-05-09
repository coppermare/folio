<p align="center">
  <img src="frontend/public/hero.jpg" alt="Folio" width="100%" />
</p>

# Folio

Folio is an AI thinking partner for commercial real estate lawyers — grounded in the documents you trust. Drag legal files into a conversation (leases, title reports, environmental assessments, side letters, surveys — whatever a deal pulls in) and ask anything about them. Folio reasons through your sources, streams the reasoning so you can see how it got there, and cites every claim back to the original page so each answer is verifiable in one click.

The full reasoning behind each design decision lives in [DECISIONS.md](DECISIONS.md).

## What it does

- **Multi-document conversations.** Drag-and-drop a PDF, DOCX, or Markdown file anywhere in the chat. Files are saved to the session and listed in a right-side workspace panel where they open in browser-like tabs. `@`-mention any uploaded document to bring it into focus mid-thread.
- **Grounded answers with click-to-jump citations.** The model is prompted to refuse rather than guess when grounding fails, and to say plainly when an answer isn't in the loaded documents. Every grounded claim carries an inline citation pill; clicking it jumps the workspace panel straight to the cited page.
- **Live agent reasoning.** A short reasoning summary streams above each answer so the user can see what the agent is doing before the answer arrives.
- **Multi-format rendering.** PDFs, Word documents, and Markdown all render in-browser with their original formatting preserved.
- **Mobile-responsive.** Works on a phone for quick lookups between meetings.

## Tech

- **Frontend:** Vite + React + TypeScript, Tailwind, shadcn/Radix UI
- **Backend:** FastAPI (Python 3.12), SQLAlchemy, Alembic, PydanticAI
- **Model:** Claude Sonnet for chat, Haiku for short utility tasks
- **Storage:** PostgreSQL
- **Runtime:** Docker Compose

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
