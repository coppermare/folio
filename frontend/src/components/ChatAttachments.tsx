import { FileText, Loader2, Paperclip, X } from "lucide-react";

export interface PendingFile {
	id: string;
	file: File;
	uploading?: boolean;
	error?: string;
}

export interface ReferenceChip {
	id: string;
	filename: string;
}

interface ChatAttachmentsProps {
	pendingFiles: PendingFile[];
	references: ReferenceChip[];
	onRemovePending: (id: string) => void;
	onRemoveReference: (id: string) => void;
}

export function ChatAttachments({
	pendingFiles,
	references,
	onRemovePending,
	onRemoveReference,
}: ChatAttachmentsProps) {
	if (pendingFiles.length === 0 && references.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1.5 border-b border-neutral-100 px-3 py-2">
			{references.map((ref) => (
				<span
					key={`ref-${ref.id}`}
					className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-700"
					title={ref.filename}
				>
					<FileText className="h-3 w-3 flex-shrink-0 text-neutral-400" />
					<span className="truncate">{ref.filename}</span>
					<button
						type="button"
						className="text-neutral-400 hover:text-neutral-700"
						onClick={() => onRemoveReference(ref.id)}
						aria-label={`Remove ${ref.filename} reference`}
					>
						<X className="h-3 w-3" />
					</button>
				</span>
			))}
			{pendingFiles.map((p) => (
				<span
					key={`pending-${p.id}`}
					className={`inline-flex max-w-[220px] items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
						p.error
							? "border-red-200 bg-red-50 text-red-600"
							: "border-neutral-200 bg-neutral-100 text-neutral-700"
					}`}
					title={p.error ?? p.file.name}
				>
					{p.uploading ? (
						<Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-neutral-400" />
					) : (
						<Paperclip className="h-3 w-3 flex-shrink-0 text-neutral-400" />
					)}
					<span className="truncate">{p.file.name}</span>
					<button
						type="button"
						className="text-neutral-400 hover:text-neutral-700"
						onClick={() => onRemovePending(p.id)}
						aria-label={`Remove ${p.file.name}`}
					>
						<X className="h-3 w-3" />
					</button>
				</span>
			))}
		</div>
	);
}
