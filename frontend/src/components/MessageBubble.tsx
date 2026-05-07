import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { citedDocuments } from "../lib/file-chip-utils";
import type { Citation, ConversationDocument, Message } from "../types";
import { CopyButton } from "./CopyButton";
import { FileChip } from "./FileChip";
import { SmoothMarkdown } from "./SmoothMarkdown";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const DOC_MARKER_RE = /\[doc:[0-9a-fA-F]{4,}(?:\s*[,;:][^\]]*)?\]/g;

function stripCitationMarkers(text: string): string {
	return text.replace(DOC_MARKER_RE, "").replace(/[ \t]{2,}/g, " ");
}

interface MessageBubbleProps {
	message: Message;
	documents: ConversationDocument[];
}

export function MessageBubble({ message, documents }: MessageBubbleProps) {
	if (message.role === "system") {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.2 }}
				className="flex justify-center py-2"
			>
				<p className="text-xs text-neutral-400">{message.content}</p>
			</motion.div>
		);
	}

	if (message.role === "user") {
		const attachedDocs =
			message.document_ids && message.document_ids.length > 0
				? message.document_ids
						.map((id) => documents.find((d) => d.id === id))
						.filter(Boolean)
				: [];

		return (
			<motion.div
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.18, ease: "easeOut" }}
				className="group flex items-end justify-end gap-1.5 py-1.5"
			>
				<div className="opacity-0 transition-opacity group-hover:opacity-100">
					<CopyButton text={message.content} />
				</div>
				<div className="flex max-w-[75%] flex-col items-end gap-1.5">
					{attachedDocs.length > 0 && (
						<div className="flex flex-col items-end gap-1">
							{attachedDocs.map((d) => (
								<span
									key={d!.id}
									className="inline-flex max-w-[220px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-600"
									title={d!.filename}
								>
									<FileText className="h-3 w-3 flex-shrink-0 text-neutral-400" />
									<span className="truncate">{d!.filename}</span>
								</span>
							))}
						</div>
					)}
					<div className="rounded-2xl rounded-br-md bg-neutral-100 px-4 py-2.5">
						<p className="whitespace-pre-wrap text-sm text-neutral-800">
							{message.content}
						</p>
					</div>
				</div>
			</motion.div>
		);
	}

	const citations = message.sources ?? [];
	const cleanContent = stripCitationMarkers(message.content);
	const cited = citedDocuments(cleanContent, documents);

	return (
		<motion.div
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.18, ease: "easeOut" }}
			className="py-2"
		>
			<div className="min-w-0">
				<AttributionLine
					citations={citations}
					documents={documents}
					documentCount={documents.length}
				/>
				<SmoothMarkdown content={cleanContent} documents={documents} />
				{cited.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{cited.map((d) => (
							<FileChip
								key={d.id}
								id={d.id}
								filename={d.filename}
								variant="block"
							/>
						))}
					</div>
				)}
				<CitationPills citations={citations} documents={documents} />
				<div className="mt-2 flex items-center gap-1">
					<CopyButton text={message.content} />
				</div>
			</div>
		</motion.div>
	);
}

interface StreamingBubbleProps {
	content: string;
	documents: ConversationDocument[];
}

export function StreamingBubble({ content, documents }: StreamingBubbleProps) {
	const cleanContent = stripCitationMarkers(content);
	return (
		<div className="py-2">
			<div className="min-w-0">
				{cleanContent ? (
					<SmoothMarkdown
						content={cleanContent}
						documents={documents}
						streaming
					/>
				) : (
					<ThinkingIndicator />
				)}
			</div>
		</div>
	);
}

interface AttributionLineProps {
	citations: Citation[];
	documents: ConversationDocument[];
	documentCount: number;
}

function AttributionLine({
	citations,
	documents,
	documentCount,
}: AttributionLineProps) {
	if (documentCount === 0 || citations.length === 0) return null;

	const usedIds = Array.from(new Set(citations.map((c) => c.document_id)));
	const usedDocs = usedIds
		.map((id) => documents.find((d) => d.id === id))
		.filter((d): d is ConversationDocument => d !== undefined);

	const usedCount = usedDocs.length;
	const allUsed = usedCount > 0 && usedCount === documentCount;
	const label = allUsed
		? `Answered from all ${documentCount} document${documentCount === 1 ? "" : "s"}`
		: `Answered from ${usedCount} of ${documentCount} document${documentCount === 1 ? "" : "s"}`;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<p className="mb-1 inline-flex cursor-help text-xs text-neutral-400">
					{label}
				</p>
			</TooltipTrigger>
			<TooltipContent>
				<ul className="space-y-0.5 text-xs">
					{usedDocs.map((d) => (
						<li key={d.id} className="truncate">
							• {d.filename}
						</li>
					))}
				</ul>
			</TooltipContent>
		</Tooltip>
	);
}

interface CitationPillsProps {
	citations: Citation[];
	documents: ConversationDocument[];
}

function CitationPills({ citations, documents }: CitationPillsProps) {
	if (citations.length === 0) return null;

	const seen = new Set<string>();
	const unique = citations.filter((c) => {
		const key = `${c.document_id}::${c.label}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	return (
		<div className="mt-2 flex flex-wrap gap-1.5">
			{unique.map((c, idx) => {
				const doc = documents.find((d) => d.id === c.document_id);
				const display = doc
					? `${doc.filename.replace(/\.pdf$/i, "")}${c.label && c.label !== doc.filename ? ` · ${c.label}` : ""}`
					: c.label;
				return (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: stable order from server
						key={`${c.document_id}-${idx}`}
						className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600"
					>
						{display}
					</span>
				);
			})}
		</div>
	);
}
