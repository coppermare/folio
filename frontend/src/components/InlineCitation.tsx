// Inline citation pill — same visual as FileChip (fully rounded, neutral
// palette) so citations feel native to the rest of the chat UI. Hovering opens
// a minimal popover: clickable filename (hover-underlined link), page +
// section locator, optional snippet as plain subtext.

import * as HoverCard from "@radix-ui/react-hover-card";
import { FileText } from "lucide-react";
import { emitJumpToPage, emitOpenDocument } from "../lib/chat-references";
import type { Citation } from "../types";

interface InlineCitationProps {
	citation: Citation;
	filename: string | null;
}

const MAX_PILL_CHARS = 22;
const MAX_POPOVER_FILENAME_CHARS = 36;
const MAX_SNIPPET_CHARS = 160;

function dropPdfExtension(name: string): string {
	return name.replace(/\.pdf$/i, "");
}

function truncate(name: string, max: number): string {
	if (name.length <= max) return name;
	return `${name.slice(0, max - 1)}…`;
}

/**
 * Format the model-emitted locator into a readable phrase. Strips the legal
 * "§" symbol and prefixes purely-numeric locators with "Section".
 */
function formatLocator(label: string | null | undefined): string | null {
	if (!label) return null;
	const trimmed = label.trim();
	if (!trimmed) return null;
	const stripped = trimmed.replace(/^§\s*/, "");
	if (stripped !== trimmed) return `Section ${stripped}`;
	if (/^[\d.]+(\s|$)/.test(trimmed)) return `Section ${trimmed}`;
	return trimmed;
}

export function InlineCitation({ citation, filename }: InlineCitationProps) {
	const handleJump = () => {
		emitOpenDocument(citation.document_id);
		if (citation.page != null) {
			emitJumpToPage(citation.document_id, citation.page);
		}
	};

	const fullName = filename ?? "Cited document";
	const displayName = dropPdfExtension(fullName);
	const pillText = truncate(displayName, MAX_PILL_CHARS);
	const popoverName = truncate(displayName, MAX_POPOVER_FILENAME_CHARS);
	const locator = formatLocator(citation.label);
	const meta = [
		citation.page != null ? `Page ${citation.page}` : null,
		locator,
	]
		.filter(Boolean)
		.join(" · ");
	const snippet = citation.snippet
		? truncate(citation.snippet, MAX_SNIPPET_CHARS)
		: null;

	return (
		<HoverCard.Root openDelay={120} closeDelay={120}>
			<HoverCard.Trigger asChild>
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleJump();
					}}
					className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 align-baseline text-[0.75em] font-medium text-neutral-700 no-underline transition-colors hover:bg-neutral-200 active:scale-[0.98]"
					title={fullName}
				>
					<FileText className="h-3 w-3 flex-shrink-0 text-neutral-700" />
					<span className="truncate">{pillText}</span>
				</button>
			</HoverCard.Trigger>
			<HoverCard.Portal>
				<HoverCard.Content
					side="top"
					align="center"
					sideOffset={6}
					className="z-50 w-72 rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-md outline-none"
				>
					<button
						type="button"
						onClick={handleJump}
						className="group flex w-full items-start gap-2 text-left"
					>
						<FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-700" />
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium text-neutral-900 group-hover:underline decoration-neutral-300 underline-offset-2">
								{popoverName}
							</span>
							{meta ? (
								<span className="block text-xs text-neutral-500">{meta}</span>
							) : null}
						</span>
					</button>
					{snippet ? (
						<p className="mt-2 text-xs leading-relaxed text-neutral-600">
							{snippet}
						</p>
					) : null}
				</HoverCard.Content>
			</HoverCard.Portal>
		</HoverCard.Root>
	);
}
