import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import type { Citation, Document, Message } from "../types";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const DOC_MARKER_RE = /\[doc:[0-9a-fA-F]{4,}(?:\s*[,;:][^\]]*)?\]/g;

function stripCitationMarkers(text: string): string {
	return text.replace(DOC_MARKER_RE, "").replace(/[ \t]{2,}/g, " ");
}

interface MessageBubbleProps {
	message: Message;
	documentCount: number;
	documents: Document[];
}

export function MessageBubble({
	message,
	documentCount,
	documents,
}: MessageBubbleProps) {
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
		return (
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.2 }}
				className="flex justify-end py-1.5"
			>
				<div className="max-w-[75%] rounded-2xl rounded-br-md bg-neutral-100 px-4 py-2.5">
					<p className="whitespace-pre-wrap text-sm text-neutral-800">
						{message.content}
					</p>
				</div>
			</motion.div>
		);
	}

	const citations = message.sources ?? [];
	const cleanContent = stripCitationMarkers(message.content);

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2 }}
			className="flex gap-3 py-1.5"
		>
			<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900">
				<Bot className="h-4 w-4 text-white" />
			</div>
			<div className="min-w-0 max-w-[80%]">
				<AttributionLine
					citations={citations}
					documents={documents}
					documentCount={documentCount}
				/>
				<div className="prose">
					<Streamdown>{cleanContent}</Streamdown>
				</div>
				<CitationPills citations={citations} documents={documents} />
			</div>
		</motion.div>
	);
}

interface StreamingBubbleProps {
	content: string;
}

export function StreamingBubble({ content }: StreamingBubbleProps) {
	const cleanContent = stripCitationMarkers(content);
	return (
		<div className="flex gap-3 py-1.5">
			<div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900">
				<Bot className="h-4 w-4 text-white" />
			</div>
			<div className="min-w-0 max-w-[80%]">
				{cleanContent ? (
					<div className="prose">
						<Streamdown mode="streaming">{cleanContent}</Streamdown>
					</div>
				) : (
					<div className="flex items-center gap-1 py-2">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
						<span
							className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
							style={{ animationDelay: "0.15s" }}
						/>
						<span
							className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
							style={{ animationDelay: "0.3s" }}
						/>
					</div>
				)}
				<span className="inline-block h-4 w-0.5 animate-pulse bg-neutral-400" />
			</div>
		</div>
	);
}

interface AttributionLineProps {
	citations: Citation[];
	documents: Document[];
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
		.filter((d): d is Document => d !== undefined);

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
	documents: Document[];
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
