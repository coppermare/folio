import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";
import {
	FILE_REF_MIME,
	emitAddFileReference,
	encodeFileRef,
} from "../lib/chat-references";
import type { ConversationDocument } from "../types";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface FileRowProps {
	document: ConversationDocument;
	onOpen: (id: string) => void;
	onRemove: (id: string) => void;
	isActive: boolean;
}

export function FileRow({
	document,
	onOpen,
	onRemove,
	isActive,
}: FileRowProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const payload = encodeFileRef({
			id: document.id,
			filename: document.filename,
		});
		try {
			if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
				const blobs = new ClipboardItem({
					[FILE_REF_MIME]: new Blob([payload], { type: FILE_REF_MIME }),
					"text/plain": new Blob([`@${document.filename}`], {
						type: "text/plain",
					}),
				});
				await navigator.clipboard.write([blobs]);
			} else {
				await navigator.clipboard.writeText(`@${document.filename}`);
			}
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch {
			// Clipboard not available; fall back to event bus.
			emitAddFileReference({ id: document.id, filename: document.filename });
		}
	};

	const handleReference = () => {
		emitAddFileReference({ id: document.id, filename: document.filename });
	};

	return (
		<div
			className={`group flex items-center gap-2 rounded-control px-2 py-2 transition-colors ${
				isActive ? "bg-neutral-100" : "hover:bg-neutral-50"
			}`}
		>
			<button
				type="button"
				onClick={() => onOpen(document.id)}
				className="flex min-w-0 flex-1 items-center gap-2 text-left"
			>
				<FileText className="h-4 w-4 flex-shrink-0 text-neutral-400" />
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium text-neutral-800">
						{document.filename}
					</p>
					<p className="text-xs text-neutral-400">
						{document.page_count} page
						{document.page_count !== 1 ? "s" : ""}
					</p>
				</div>
			</button>

			{copied && <span className="text-xs text-neutral-400">Copied</span>}

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="iconSm"
						className="text-neutral-400 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
						aria-label="File actions"
					>
						<ChevronDown className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-[12rem]">
					<DropdownMenuItem onSelect={() => onOpen(document.id)}>
						Open
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={handleReference}>
						Reference in chat
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={handleCopy}>
						Copy reference
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => onRemove(document.id)}
					>
						Remove
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
