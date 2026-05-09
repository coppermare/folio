# Folio — Design Decisions

A short record of the calls I made, the user pain each one addresses, and the trade-off worth defending.

## 1. Multi-document conversations with a workspace panel

Beta lawyers were re-uploading the same files into new conversations whenever a question crossed more than one document. Now a conversation holds many documents: drag-and-drop a PDF, DOCX, or Markdown file anywhere in the chat and it's saved to the session and listed in a right-side **workspace panel** where files open in browser-like tabs. Inside the chat, **@-mentioning** an uploaded document brings it into focus mid-thread. Per-conversation dedup makes accidental re-uploads a silent no-op. A two-step first-run intro captures an optional first name (localStorage only, never sent to the model) so returning users land on *"Hi, {name}."* instead of a generic empty state.

## 2. Grounded answers: trust comes from the model, not from warnings

The strongest signal in the beta data was hallucination — about 16% of answers cited zero sources, and the customer quotes were the harshest in the set ("terrifying", "confidently wrong is worse than slow"). One reading was to surface uncertainty with a UI warning ribbon, but the deeper pain was that *the model itself should be trustworthy*, not that *the UI should warn me when it isn't*. So I fixed it at the source: I rewrote the system prompt with explicit honesty rules — refuse rather than guess, say plainly *"I don't see X in the loaded documents"*, acknowledge partial coverage. I also moved the chat model from **Haiku to Sonnet**: lawyers value accuracy over latency, and Sonnet is materially more reliable on long lease text and on the structured-output contract that produces citations. Every grounded claim carries an inline citation pill; clicking it jumps the workspace panel to the exact page.

## 3. Multi-format documents

Title reports arrive as DOCX; internal notes live in Markdown. Forcing a manual PDF conversion was friction. DOCX now renders in-browser preserving Word's own formatting (not re-styled as plain HTML — lawyers want the document *as it is*), and Markdown renders with tables and task lists. I also fixed a quiet bug where citations on non-paginated formats were being stripped as out-of-range — DOCX and MD answers are now treated the same as PDF.

## 4. Transparency, polish, and reach

To make the agent feel less like a black box, I surfaced its **reasoning summary** above each answer — a short live trace of what it's reading and which steps it's taking. A lawyer who sees something like *"checking section 4 of the lease for the break clause"* before the answer arrives has a clearer mental model of what's being grounded on, and the wait stops feeling opaque. I tightened streamed-text rendering so the post-stream component swap is visually identical bytes (no flicker), added a **copy button** on every message, and drew a small logo so the product reads as a real, named thing. The biggest reach decision: the app is **mobile-responsive**, so a lawyer can pull up a lease on a phone between meetings.

## What's next

**Projects.** What lawyers actually need is **context that persists across conversations**: one place where all their files live so they can ask questions across them without re-uploading per session. I sketched this as a "Projects" teaser rather than building it — the right model is a project-level document store that conversations attach to. Out of scope here, but the most valuable thing to build next.

**Creating and editing files with the AI.** Today the agent only reads documents. The natural next step is letting it produce them: drafting a memo, redlining a clause, or generating a summary the user can hand to a client. Markdown is the easy first format — it maps cleanly to how LLMs already think — but the real value is **DOCX and PDF**, since that's what lawyers actually send. If this product gets built out further, file authoring belongs alongside file Q&A.

## Notes on internals

**Citation marker syntax.** The model emits `[cite:N]` markers inline, where `N` is a positional reference into the typed `Answer.sources` array — not the document ID. The earlier `[doc:ID]` form is kept as a regex-only fallback for the unstructured-output code path; the typed `Answer.sources` array is the source of truth for what was cited.

**Naming.** The repo is `folio` but the Postgres database, pyproject package name, and Python imports remain `orbital_takehome` (the original template name). Cosmetic only; renaming would touch alembic, pyproject, every import, and Docker env without changing behaviour. Deferred until there's a non-cosmetic reason.
