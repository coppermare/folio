import { FileText } from "lucide-react";
import type { ConversationDocument } from "../types";

interface FileMentionPopoverProps {
	query: string;
	documents: ConversationDocument[];
	excludeIds: string[];
	onPick: (doc: ConversationDocument) => void;
	onClose: () => void;
}

export function FileMentionPopover({
	query,
	documents,
	excludeIds,
	onPick,
}: FileMentionPopoverProps) {
	const candidates = documents
		.filter((d) => !excludeIds.includes(d.id))
		.filter((d) =>
			query.length === 0
				? true
				: d.filename.toLowerCase().includes(query.toLowerCase()),
		);

	return (
		<div className="absolute bottom-full left-0 z-30 mb-1 w-72 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
			{candidates.length === 0 ? (
				<p className="px-3 py-2 text-xs text-neutral-400">
					{documents.length === 0
						? "No files yet — upload one first."
						: "No matching files."}
				</p>
			) : (
				<div className="max-h-64 overflow-y-auto">
					{candidates.map((doc) => (
						<button
							key={doc.id}
							type="button"
							className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none"
							onMouseDown={(e) => {
								// Prevent textarea blur before pick fires.
								e.preventDefault();
							}}
							onClick={() => onPick(doc)}
						>
							<FileText className="h-4 w-4 flex-shrink-0 text-neutral-400" />
							<span className="truncate">{doc.filename}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
