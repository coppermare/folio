import type { Citation, ConversationDocument } from "../types";

const FOLIO_DOC_SCHEME = "folio-doc://";

export const FOLIO_DOC_PREFIX = FOLIO_DOC_SCHEME;

const FOLIO_CITE_SCHEME = "folio-cite://";
export const FOLIO_CITE_PREFIX = FOLIO_CITE_SCHEME;

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$1");
}

/**
 * Replace exact filename mentions in the markdown content with markdown links
 * pointing at a `folio-doc://<id>` URL. The Streamdown renderer overrides
 * anchor rendering for that scheme to render an inline FileChip.
 *
 * Filenames are matched case-insensitive and only when they sit at a token
 * boundary (so "lease.pdf" inside a path or longer word is left alone).
 * Mentions already inside a markdown link (`](filename...)` or `[filename](...)`)
 * are skipped via a simple lookbehind.
 */
export function injectFileChipLinks(
	content: string,
	documents: Pick<ConversationDocument, "id" | "filename">[],
): string {
	if (!content || documents.length === 0) return content;

	// Sort by length desc so "Master Lease.pdf" wins over "Lease.pdf".
	const sorted = [...documents].sort(
		(a, b) => b.filename.length - a.filename.length,
	);

	let result = content;
	const consumed = new Set<string>();

	for (const doc of sorted) {
		if (consumed.has(doc.id)) continue;
		const escaped = escapeRegex(doc.filename);
		// Boundary: not preceded by `[`, `]`, `(`, `/`, or letter/number;
		// not followed by `]` or `)` (already a link).
		const re = new RegExp(
			`(^|[\\s"'\`(])${escaped}(?=[\\s.,;:!?)\\]"'\`]|$)`,
			"gi",
		);
		result = result.replace(re, (_match, lead) => {
			consumed.add(doc.id);
			return `${lead}[${doc.filename}](${FOLIO_DOC_SCHEME}${doc.id})`;
		});
	}

	return result;
}

/** Documents whose filename is mentioned anywhere in the response text. */
export function citedDocuments<T extends { id: string; filename: string }>(
	content: string,
	documents: T[],
): T[] {
	if (!content) return [];
	const lower = content.toLowerCase();
	return documents.filter((d) => lower.includes(d.filename.toLowerCase()));
}

/**
 * Convert legal-style alphabetical enumerations (``(a) X; (b) Y; (c) Z``) into
 * Markdown bullet lists. Preserves the ``(a)/(b)/(c)`` prefixes because they
 * are referenced by surrounding prose ("the conditions in (b) and (c)…") and
 * stripping them would break those cross-references.
 *
 * Triggers only on runs of 2+ consecutive markers. Tolerant of an optional
 * "and" before the final item (``…; and (d) X.``).
 */
const ALPHA_ENUM_RE =
	/(:\s+|\.\s+|\n)((?:\([a-z]\)\s+[^.\n;,]+(?:[;,]\s*(?:and\s+)?(?=\([a-z]\)\s)))+\([a-z]\)\s+[^.\n]+)\.?/g;

export function listifyAlphaEnumeration(content: string): string {
	if (!content) return content;
	return content.replace(ALPHA_ENUM_RE, (_full, prefix: string, body: string) => {
		const items = body
			.split(/[;,]\s*(?:and\s+)?(?=\([a-z]\)\s)/)
			.map((s) => s.trim().replace(/\.$/, ""))
			.filter(Boolean);
		if (items.length < 2) return _full;
		const list = items.map((s) => `- ${s}`).join("\n");
		return `${prefix}\n${list}`;
	});
}

/**
 * Unique documents referenced by this message's citations (in stable first-
 * appearance order). Drives the "Drew on:" FileChip attribution row at the top
 * of an assistant bubble.
 */
export function citationDocuments<T extends { id: string; filename: string }>(
	citations: Citation[] | null | undefined,
	documents: T[],
): T[] {
	if (!citations || citations.length === 0) return [];
	const seen = new Set<string>();
	const out: T[] = [];
	for (const c of citations) {
		if (seen.has(c.document_id)) continue;
		seen.add(c.document_id);
		const doc = documents.find((d) => d.id === c.document_id);
		if (doc) out.push(doc);
	}
	return out;
}

/**
 * Convert ``[cite:N]`` markers in prose into markdown links pointing at
 * ``folio-cite://N``. The SmoothMarkdown anchor override intercepts that
 * scheme and renders an :class:`InlineCitation` pill.
 *
 * Mid-stream tolerance is automatic: only fully-closed ``[cite:N]`` patterns
 * match the regex, so truncated tokens like ``[cit`` or ``[cite:`` stay as
 * literal text and resolve once the streaming tick completes.
 *
 * Dedup: same ``(document_id, page, label)`` cited multiple times collapses to
 * a single inline pill at the first marker position. Subsequent identical
 * markers are stripped (no ``×N`` badge — distinct citations render as
 * distinct pills, identical ones collapse to one).
 */
const CITE_MARKER_RE = /\[cite:(\d+)\]/g;

export function injectInlineCitations(
	content: string,
	sources: Citation[] | null | undefined,
): string {
	if (!content) return content;
	if (!sources || sources.length === 0) {
		// Strip any orphan markers (sources empty → markers are noise).
		return content.replace(CITE_MARKER_RE, "");
	}

	const tupleKey = (c: Citation) =>
		`${c.document_id}::${c.page ?? ""}::${(c.label ?? "").toLowerCase()}`;

	// First marker for each unique tuple becomes a pill; later identical
	// markers are stripped. The link text is a small placeholder ("cite") that
	// the InlineCitation component replaces — never directly rendered.
	const placedTuples = new Set<string>();
	return content.replace(CITE_MARKER_RE, (full, nStr) => {
		const n = Number(nStr);
		const c = sources[n];
		if (!Number.isInteger(n) || n < 0 || c === undefined) return full;
		const key = tupleKey(c);
		if (placedTuples.has(key)) return "";
		placedTuples.add(key);
		return `[cite](${FOLIO_CITE_SCHEME}${n})`;
	});
}
