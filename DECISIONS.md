# Folio — Design Decisions

A running log of non-obvious design choices and the reasoning behind them. Keep entries dated.

---

## Part 2b — Grounded Answers

**Date:** 2026-05-07
**Branch:** `coppermare/part-2b-redesign-grounded-answers-trust-citations`

### The problem

Three weeks of beta data (`data/usage_events.csv`, `data/customer_feedback.md`) surfaced one dominant UX failure: **trust**.

- Responses citing 0 sources: **49 / 302 = 16.2%** — about 1 in 6 answers is ungrounded.
- Citation distribution (0/1/2/3/4/5): 49 / 25 / 60 / 61 / 56 / 51 — bimodal, not gradual. Zero is the long-tail outlier.
- Thumbs-down rate: 25 / 102 = 24.5%, concentrated on trust complaints.
- Customer feedback: 4 of 9 verbatim quotes describe hallucination ("terrifying", "career-damaging", "confidently wrong is worse than slow", "I'd pay double the licence fee for a confidence indicator").

### Alternatives considered (and why dropped)

| Alternative | Reason cut |
|---|---|
| Annotation/highlighting | One quote, low data signal, doesn't move trust. |
| Report export | Workflow nicety; not the trust problem. (More valuable after grounded answers ships verified citations — logged as "Part 3" follow-on.) |
| In-doc Ctrl+F | One trainee's quote; mechanical. |
| Cross-doc compare | Overlaps with multi-doc workspace; future work. |
| Re-upload friction | Solved by multi-doc workspace. |

Trust won on three axes simultaneously: most quotes, hardest data signal, strategic alignment with Orbital's CTO public stance ("In legal, accuracy is not optional").

### Three layers of "Grounded Answer"

**Layer 1 — Inline citation pills.** Compact pill at the position of each cited claim (`§4.2` or `p.12`). Click/hover opens a popover card with filename + page + snippet + Jump-to-page button. Modeled on [AI SDK Elements' `InlineCitation`](https://elements.ai-sdk.dev/components/inline-citation). Reuses the existing `FileChip` for the doc-level "Drew on:" attribution row at the message header.

**Layer 2 — Refuse-when-ungrounded prompt contract** (replaces the originally-planned UI confidence ribbon — see "Reframing Layer 2" below).

The model itself is the trust signal. The system prompt's **HONESTY RULES** section requires the model to refuse rather than guess when grounding fails: explicit "I don't see X in the loaded documents" templates, plain disclosure when text extraction failed, partial-coverage acknowledgement, no-fabrication enforcement, and a "Beyond the documents:" prefix when speculation is unavoidable. The signal arrives *in the prose itself*, in the lawyer's natural reading flow, rather than as a warning ribbon overlaid on confident-sounding text.

Server-side `verify_citations` (`services/llm.py:371`) remains as a silent safety net: it strips hallucinated cites (unknown doc_id, out-of-range page, snippet not on cited page) and computes a `confidence` value (`grounded` / `partial` / `ungrounded`) that flows through the SSE pipeline and is logged via the `answer_confidence` telemetry event. **No ribbon is rendered.** The plumbing stays so we can measure whether the prompt change moves the 16.2% number — telemetry without UI.

**Layer 3 — "Show your work" panel.** Deferred to future work. Costs the most code for the smallest delta over Layer 1; would have pushed beyond the 90-min budget.

### Reframing Layer 2: why a UI ribbon was rejected

The original design specified amber (`partial`) and red (`ungrounded`) ribbons with verbatim copy. That design was reconsidered during pre-PR QA and replaced with the prompt-level approach above. The reasoning:

- **Ribbons are a patch on a behavior we should fix upstream.** A red ribbon says "the model just answered without grounding" — but the right product response is to make the model not answer ungroundedly in the first place. Tightening the prompt (refuse-when-ungrounded, no-fabrication, partial-coverage acknowledgement) addresses the cause; ribbons paper over the symptom.
- **Ribbons train mistrust.** In the lawyer persona, a red bar appearing on ~16% of answers reads as "this tool is unreliable." It accelerates the churn the feature was meant to prevent (Senior Associate's *"she stopped using it"* in customer_feedback.md). A model that says *"I don't see a break clause in this lease — the term provisions are at §3 but no early-termination right is granted"* sounds like a careful junior associate; the same answer with a red ribbon on top sounds like a tool warning the user not to trust it.
- **The two failure modes the ribbon would have caught are absorbed into the prose:**
  - *Ungrounded answer with docs loaded* → model refuses with a templated "I don't see X" sentence, citing what is covered.
  - *Partial (server stripped a cite)* → still rare in practice; remaining cases are silent at the UI layer and visible in telemetry. If `partial` rates climb, that's a prompt-or-retrieval signal, not a UX one.
- **Reliability beats transparency in this persona.** Partner A's quote — *"I'd pay double the licence fee if the AI would just tell me when it's not sure"* — was originally read as a request for an explicit UI signal. On reflection, the lawyer's actual ask is honesty about uncertainty; the model saying so in plain text answers that ask more directly than a coloured bar.

This is the single most contestable decision in the submission. If a reviewer disagrees, the disagreement is between **honesty-via-prompt-contract** (chosen) and **honesty-via-UI-ribbon** (originally specified). The prompt approach removes ~80 LOC of UI work, removes the "this tool keeps warning me" affordance, and shifts the trust burden to where it belongs — onto the model's own behavior, measured via the telemetry that already exists.

### Technical decisions

**Single-pass PydanticAI structured streaming.** `agent.run_stream(output_type=Answer)` with partial-validation streaming. Structured output is exactly the right tool here — typed citation extraction natively.

- Considered: two-pass (regex stream + non-streaming `agent.run`). Rejected — doubles tokens, adds 1–3s latency, lets the model invent citations not in the prose.
- Considered: pure deterministic post-processing (regex doc IDs + substring page-match). Rejected — contravenes "Bet on the Model" mantra; structured output is exactly the right tool here.
- Trade-off accepted: prose deltas arrive on JSON-token boundaries instead of natural-language tokens. Slightly chunkier streaming UX. Worth it for typed citations + per-citation page numbers + snippets.
- Fallback: on `ValidationError`, retry-extract via regex over accumulated prose (legacy `[doc:ID]` form). If that yields nothing, downgrade to `ungrounded` — the SSE stream never crashes.

**Indexed `[cite:N]` markers replace `[doc:ID]`.** With `[doc:ID]`, the same doc cited at three different pages produces three indistinguishable inline markers — we couldn't map each badge to the correct page in `sources[]`. `[cite:0]`, `[cite:1]`, `[cite:2]` index directly into `sources[N]` for unambiguous mapping. Server validates 1:1 correspondence; orphan markers (N out of range) and orphan sources (no matching marker) are dropped.

**`Message.content` stored WITH markers.** Previously the server marker-stripped before persisting (`messages.py:175`). With inline citations as first-class UI nodes, markers carry positional data — strip on persist and inline citations vanish on every page refresh. Markers are stripped only at the LLM history boundary (`routers/messages.py:142`) so the model doesn't see (and mimic) stale markers.

**Mid-stream partial-token tolerance.** The remark-side regex only matches *fully closed* `[cite:N]` patterns. Truncated tokens like `[cit`, `[cite:`, or `[cite:0` (no closing bracket) stay as literal text and resolve when the next streaming tick fills them in. Prevents flicker of broken-looking text mid-stream.

**No new DB column, no migration.** `Message.sources` JSONB widens shape to `{confidence, citations:[…]}`. Legacy bare-list rows handled by a single `unwrap_sources(raw)` helper: `isinstance(raw, list)` → wrap (`confidence` derived from count); else read as dict. The `MessageOut` API exposes `confidence` and `sources` as flat fields — the wrapper is a storage detail.

**Confidence rides on `MessageOut` AND a dedicated `citations` SSE event before `done`.** Issue spec mandates the `citations` event verbatim; the frontend uses a `pendingCitationsRef` stash to handle ordering either way (citations before message → buffer; after message → patch by id). `MessageOut.confidence` gives refetch / legacy paths the same data.

**Click-to-jump pub/sub.** `PdfRenderer.handleJump` is an internal closure; the multi-doc workspace did NOT ship a page-jump capability. New `emitJumpToPage(docId, page)` + sticky last-value buffer mirrors `emitOpenDocument`. The sticky buffer covers the async gap when a citation triggers `emitOpenDocument` for a doc that hasn't mounted yet — `PdfRenderer` reads its pending entry on mount and consumes-and-clears it. Cross-doc `emitOpenDocument` clears stale entries.

**Model tier: Sonnet for chat, Haiku for titles.** `claude-sonnet-4-6` for `chat_with_documents` — higher reliability with structured output on long lease text. `claude-haiku-4-5-20251001` retained for `generate_title` (5-word task). Lawyers value accuracy over speed (Partner B); accept the latency cost.

**Flicker fix.** Removed the `fetchMessages` refetch in `use-messages.ts` after stream end — the canonical `message` SSE event already carries everything; an extra refetch caused a second re-render that violated the issue's *"streaming + citations integrate without flicker"* criterion. `StreamingBubble` and the canonical `MessageBubble` now render prose via the **same `SmoothMarkdown` instance with identical props**, so the post-stream component swap is visually identical bytes.

### Telemetry

`logger.info("answer_confidence", confidence=…, valid_citations=…, stripped_citations=…, conversation_id=…, message_id=…)` (structlog kwargs) at persist time. Required to measure whether the trust intervention moves the 16.2% ungrounded number across the beta cohort — without a metric we can't tell if the intervention worked.

### Accessibility

With the ribbon dropped (see "Reframing Layer 2"), the trust signal is now the model's own prose. That means the existing message-bubble a11y carries it for free: screen readers read the model's "I don't see X in the loaded documents" sentence in natural reading order, no `aria-live` overlay required. Citation pills retain their button semantics + keyboard activation from `InlineCitation.tsx`.

### Things explicitly cut from v1

- **Quoted-text heuristic for `partial`** — too many false positives on legal prose (defined terms like `"Tenant"`, `"Force Majeure Event"`, quoted clause names). Detecting uncited claims robustly needs an eval harness. Logged below as future work.
- **`FOLIO_LLM_FAKE` env var** — over-engineered for the budget. Unit tests use direct mocking; E2E uses real LLM with manually-curated prompts (acknowledged flaky; deterministic tests are the durable signal).
- **Layer 3 "Show your work" panel** — costs the most code for the smallest delta over Layer 1.
- **Span-level highlight in viewer** — page-level scroll only for v1.
- **Per-citation quality / confidence score** — model would need to self-rate; future work.

### Known v1 limitations

- **PDF physical vs printed page numbers.** PyMuPDF counts physical pages 1-indexed; legal docs with unnumbered front matter mean lawyers' "printed page 5" may be PDF page 8. Future work: use PyMuPDF's `page.get_label()` to surface printed labels alongside physical numbers.
- **Snippet verification is bounds-only.** Server confirms the snippet substring exists *somewhere* on the cited page, not that it semantically corresponds to the claim. A motivated-or-confused model could pick a different page that happens to share phrasing and pass the check. Future work: eval harness with known-clause ground truth.
- **Uncited claims are not detected.** The model can make a factual claim with no inline marker and v1 won't flag it. Future work: Layer 3 "Show your work" + eval harness.

### Future work

- Layer 3 — "Show your work" disclosure panel listing cited snippets per doc with "Verify this claim →" links.
- Span-level highlight (text-range, not page) in the document viewer.
- Eval harness with known-clause ground truth so we can quantify hallucination rate before vs after this change.
- Per-citation quality score (model-emitted confidence per source).
- Structured `<page n="…">` blocks in the prompt instead of `--- Page N ---` separators.
- Uncited-claim detection (NLI or second-pass classifier).
- **Part 3 — Export grounded answers as a client memo.** The export, if pursued, becomes a *trust amplifier* now that grounded answers ships verified citations: the exported memo carries the page numbers, snippets, and confidence state with it. Senior Associate E (1 of 9 verbatim quotes): *"I'm copy-pasting answers from the chat into a Word doc for the client, which defeats the purpose of saving time."*

---

## Part 2c — Multi-format documents & first-run onboarding (2026-05-08)

Two user-visible changes shipped together for [Linear K-116](https://linear.app/) plus a small personalization touch.

### Why

**Multi-format support.** The lawyers in the beta cohort don't only work with PDFs. Title reports often arrive as DOCX from the registry; internal notes, deal summaries, and clause libraries live in Markdown in repos and Notion exports. Forcing a manual PDF conversion before upload was friction — and meaningfully reduced the surface area on which the assistant felt useful. The backend extraction pipeline already supported `.docx` (via `python-docx`) and `.md` (plain UTF-8) since commit `489f7cf`; what was missing was the user-facing edge: file-picker accept attribute, viewer rendering, and correct `Content-Type` headers.

**Onboarding modal.** A first impression of an empty chat with a generic heading ("Your legal documents, decoded.") gave no orientation for new users and nothing to make the tool feel theirs. A two-step carousel — what Folio is, then an optional name — costs ~2 seconds and produces a small but real ownership signal in the empty state ("Hi, {name}.") that persists across sessions.

### Technical decisions

**`docx-preview` for in-browser DOCX rendering, lazy-loaded.** The user direction was explicit: "display as it is, like we do with PDF" — i.e., preserve Word's own formatting, not re-style as plain HTML.

- Considered: `mammoth.js` (DOCX → clean semantic HTML). Rejected — produces correct text but loses paragraph styles, page sizing, and embedded layout. Acceptable for text Q&A; not for "as it is."
- Considered: server-side LibreOffice headless to convert DOCX → PDF and reuse `PdfRenderer`. Rejected — adds a heavy native dependency to the backend image and a per-document conversion latency; doesn't justify the fidelity gain over `docx-preview` for our threat model (lawyers' own working documents).
- Chosen: `docx-preview`. Walks the DOCX XML and emits styled DOM that preserves the document's own fonts, sizes, headings, tables, lists, and page breaks — no hardcoded `prose` overrides from us. Loaded via dynamic `import()` in `DocxRenderer` so the ~250kB cost is only paid when a user actually opens a DOCX.

**`react-markdown` + `remark-gfm` for `.md`, with explicit element-level Tailwind styling.** No typography plugin is installed in this codebase, so the renderer applies minimal styling per element type via Tailwind's arbitrary-variant selectors (`[&_h1]:…`, `[&_table]:…`). GFM enables tables, task lists, and strikethrough — common in lawyer notes and clause repos.

**File-type metadata stays out of the DB.** No new `kind` / `mime_type` column on `Document`. Both backend (`_media_type_for(filename)` via extension dispatch) and frontend (`detectKind(filename)`) derive type from the filename suffix at request time. Adding a column would have meant a migration plus per-row populate plus another field to keep in sync; the suffix is the source of truth and the cost of recomputing it is zero. Re-evaluate if we ever support extensions whose true type can't be inferred from the name.

**Citation grounding for non-paginated formats: clear `page` rather than strip.** PDF citations carry a 1-indexed page; DOCX/MD have `page_count = 0` and no page concept. The LLM, following the schema description, still emits `page=1` for non-paginated documents. The original `verify_citations` bounds check (`page <= page_count`) stripped these as out-of-range, which downgraded every non-PDF answer to `ungrounded` despite the prose being grounded. Fix: when `page_count == 0`, treat the citation as page-agnostic — clear `page` to `None` and keep the citation. The system prompt was also updated to instruct the model to use `page=null` for non-paginated docs, but the server-side fix is the load-bearing one (model compliance with the prompt is best-effort).

**Onboarding: localStorage-only, zero backend.** No `User` table, no auth, no per-request header. Two flags — `folio:user:name` and `folio:onboarding:completed` — under the same `folio:` prefix already used by `use-panel-layout`. Greeting is rendered in `EmptyState`; the LLM system prompt is unchanged (a personalized opener doesn't need to flow into the model context, and adding it would touch the message protocol for a UI-only signal).

**Modal can be dismissed via Skip on either step or ESC.** Initial draft blocked ESC and pointer-outside dismissal entirely — interpreting "first-run modal" as something the user must engage with. On a11y review, this fails keyboard users (no exit on step 0 except Tab to Next); per CLAUDE.md style of "honesty over fluency", the right behavior is *easy to skip* rather than *force a flow*. ESC now calls `onComplete(null)` — same as Skip. Pointer-outside still no-ops to avoid accidental dismissal during the brief intro.

### Things explicitly cut

- **Server-side DOCX → PDF conversion.** Heavier infra than the fidelity gain warrants for our docs.
- **Storing user name on the backend.** Would require a `User` model and per-request identification. Out of scope for a single-tenant beta tool; localStorage is the right fit for a UI-only personalization.
- **Personalizing the LLM system prompt with the user's name.** The greeting is a UI affordance, not a context for the model. Leaking it into every prompt adds tokens and tempts the model to overuse the name in answers.
- **Markdown typography plugin.** Adding `@tailwindcss/typography` would have given a one-line `prose` class; chose explicit element styles instead so the markdown panel matches the surrounding Folio neutral palette without a global theme override.

### Known v1 limitations

- **DOCX edge cases.** `docx-preview` loses fidelity on embedded equations, complex SmartArt, and some custom theme XML. Acceptable for legal documents; revisit if a customer hits a real document we can't render.
- **No file-type icon in the file row.** All formats currently show the same generic file icon. Trivial future polish.
- **Existing browser sessions see the modal once.** No grandfather flag — anyone whose `localStorage` lacks `folio:onboarding:completed` will see the carousel on next reload. Per user direction; cost is one transient interruption.
