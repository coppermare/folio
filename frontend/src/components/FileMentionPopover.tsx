import { FileText } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ConversationDocument } from "../types";

export function filterMentionCandidates(
	documents: ConversationDocument[],
	excludeIds: string[],
	query: string,
): ConversationDocument[] {
	const q = query.toLowerCase();
	return documents
		.filter((d) => !excludeIds.includes(d.id))
		.filter((d) => q.length === 0 || d.filename.toLowerCase().includes(q));
}

interface FileMentionPopoverProps {
	candidates: ConversationDocument[];
	hasAnyDocuments: boolean;
	activeIndex: number;
	onActiveIndexChange: (index: number) => void;
	onPick: (doc: ConversationDocument) => void;
}

export function FileMentionPopover({
	candidates,
	hasAnyDocuments,
	activeIndex,
	onActiveIndexChange,
	onPick,
}: FileMentionPopoverProps) {
	const activeRef = useRef<HTMLButtonElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run on activeIndex change so keyboard nav scrolls the highlighted item (tracked via activeRef) into view.
	useEffect(() => {
		activeRef.current?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	return (
		<div className="absolute bottom-full left-0 z-30 mb-1 w-72 max-w-[calc(100vw-1.5rem)] rounded-button border border-neutral-200 bg-white p-1 shadow-lg">
			{candidates.length === 0 ? (
				<p className="px-3 py-2 text-xs text-neutral-400">
					{!hasAnyDocuments
						? "No files yet — upload one first."
						: "No matching files."}
				</p>
			) : (
				<div className="max-h-64 overflow-y-auto">
					{candidates.map((doc, i) => {
						const isActive = i === activeIndex;
						return (
							<button
								key={doc.id}
								ref={isActive ? activeRef : undefined}
								type="button"
								aria-label={`Select ${doc.filename}`}
								className={`flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400 ${
									isActive ? "bg-neutral-100" : "hover:bg-neutral-100"
								}`}
								onMouseEnter={() => onActiveIndexChange(i)}
								onMouseDown={(e) => {
									e.preventDefault();
								}}
								onClick={() => onPick(doc)}
							>
								<FileText className="h-4 w-4 flex-shrink-0 text-neutral-400" />
								<span className="truncate">{doc.filename}</span>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
