import { FileText } from "lucide-react";
import { emitOpenDocument } from "../lib/chat-references";

interface FileChipProps {
	id: string;
	filename: string;
	variant?: "inline" | "block";
}

const MAX_CHARS = 22;

function truncate(name: string): string {
	if (name.length <= MAX_CHARS) return name;
	const dot = name.lastIndexOf(".");
	if (dot > 0 && dot > name.length - 6) {
		const ext = name.slice(dot);
		const base = name.slice(0, MAX_CHARS - ext.length - 1);
		return `${base}…${ext}`;
	}
	return `${name.slice(0, MAX_CHARS - 1)}…`;
}

export function FileChip({ id, filename, variant = "inline" }: FileChipProps) {
	const isInline = variant === "inline";
	const display = truncate(filename);

	return (
		<button
			type="button"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				emitOpenDocument(id);
			}}
			className={
				isInline
					? "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 align-baseline text-[0.85em] font-medium text-neutral-700 no-underline transition-colors hover:bg-neutral-200 active:scale-[0.98]"
					: "inline-flex max-w-full items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 active:scale-[0.98]"
			}
			title={filename}
		>
			<FileText
				className={
					isInline
						? "h-3 w-3 flex-shrink-0 text-neutral-700"
						: "h-3.5 w-3.5 flex-shrink-0 text-neutral-700"
				}
			/>
			<span className="truncate">{display}</span>
		</button>
	);
}
