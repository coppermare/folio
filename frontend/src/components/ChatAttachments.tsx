import { FileText, Loader2, X } from "lucide-react";

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

/**
 * Render a filename so the extension is always visible — truncate the stem
 * with an ellipsis, keep the trailing ".pdf" / ".docx" / ".md" pinned.
 */
function FilenameDisplay({ name }: { name: string }) {
	const dot = name.lastIndexOf(".");
	if (dot <= 0 || dot === name.length - 1) {
		return <span className="truncate">{name}</span>;
	}
	return (
		<span className="flex min-w-0 items-baseline">
			<span className="truncate">{name.slice(0, dot)}</span>
			<span className="flex-shrink-0">{name.slice(dot)}</span>
		</span>
	);
}

interface AttachmentChipProps {
	filename: string;
	icon: "file" | "loading";
	error?: string;
	onRemove: () => void;
	removeLabel: string;
}

function AttachmentChip({
	filename,
	icon,
	error,
	onRemove,
	removeLabel,
}: AttachmentChipProps) {
	return (
		<span
			className={`inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium ${
				error
					? "border-red-200 bg-red-50 text-red-600"
					: "border-neutral-200 bg-neutral-100 text-neutral-700"
			}`}
			title={error ?? filename}
		>
			{icon === "loading" ? (
				<Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-neutral-400" />
			) : (
				<FileText className="h-3 w-3 flex-shrink-0 text-neutral-400" />
			)}
			<FilenameDisplay name={filename} />
			<button
				type="button"
				className="ml-0.5 flex-shrink-0 text-neutral-400 hover:text-neutral-700"
				onClick={onRemove}
				aria-label={removeLabel}
			>
				<X className="h-3 w-3" />
			</button>
		</span>
	);
}

export function ChatAttachments({
	pendingFiles,
	references,
	onRemovePending,
	onRemoveReference,
}: ChatAttachmentsProps) {
	if (pendingFiles.length === 0 && references.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1.5 px-3 py-2">
			{references.map((ref) => (
				<AttachmentChip
					key={`ref-${ref.id}`}
					filename={ref.filename}
					icon="file"
					onRemove={() => onRemoveReference(ref.id)}
					removeLabel={`Remove ${ref.filename} reference`}
				/>
			))}
			{pendingFiles.map((p) => (
				<AttachmentChip
					key={`pending-${p.id}`}
					filename={p.file.name}
					icon={p.uploading ? "loading" : "file"}
					error={p.error}
					onRemove={() => onRemovePending(p.id)}
					removeLabel={`Remove ${p.file.name}`}
				/>
			))}
		</div>
	);
}
