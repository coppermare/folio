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

**Layer 2 — Confidence states.**

| State | Trigger | Treatment |
|---|---|---|
| Grounded | ≥1 verified citation, zero stripped | No ribbon — pills *are* the indicator |
| Partial | ≥1 valid citation **and** at least one was stripped (failed verification) | Amber bar with warning-triangle icon: *"Some claims in this answer aren't backed by your documents."* |
| Ungrounded | Zero valid citations (or no documents loaded) | Red bar with shield-x icon: *"This answer isn't backed by your documents. Verify before relying on it."* |

Ribbon is suppressed when the conversation has zero documents — the warning is meaningless without docs to check against. Critically NOT suppressed when docs exist but none were cited; that's exactly when ungrounded should fire loudest.

**Layer 3 — "Show your work" panel.** Deferred to future work. Costs the most code for the smallest delta over Layer 1; would have pushed beyond the 90-min budget.

### The contestable call: silent-when-good vs always-show-state

**Chose silent-when-good.** Pills *are* the positive signal; ribbons reserved for risk. Trains the eye to read ribbons as warnings.

**Counter-argument:** always-show-state (e.g. green badge on every grounded answer) is closer to Partner A's literal *"I'd pay double the licence fee if the AI would just tell me when it's not sure"* request — explicit positive feedback. But it devalues the signal — every answer screams. After three weeks of beta noise, "grounded" badges become wallpaper.

This is the single most contestable decision in the submission. If a reviewer disagrees, it's the right disagreement to have — documented here so the disagreement is deliberate, not accidental.

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

`ConfidenceRibbon` uses **icon + color** (warning triangle / shield-x — not color alone, for colorblind safety) and `role="alert"` + `aria-live="polite"` so screen readers announce when the ribbon appears post-stream. Tailwind palette only — no new tokens.

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
