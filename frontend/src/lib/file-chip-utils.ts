import type { ConversationDocument } from "../types";

const FOLIO_DOC_SCHEME = "folio-doc://";

export const FOLIO_DOC_PREFIX = FOLIO_DOC_SCHEME;

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
