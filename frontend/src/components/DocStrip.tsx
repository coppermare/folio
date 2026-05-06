import { FileText, Loader2, Plus, TriangleAlert } from "lucide-react";
import { type DragEvent, useCallback, useRef } from "react";
import type { Document } from "../types";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface DocStripProps {
	documents: Document[];
	activeDocumentId: string | null;
	uploadingCount: number;
	onSelect: (documentId: string) => void;
	onUpload: (file: File) => void;
}

export function DocStrip({
	documents,
	activeDocumentId,
	uploadingCount,
	onSelect,
	onUpload,
}: DocStripProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) onUpload(file);
			if (fileInputRef.current) fileInputRef.current.value = "";
		},
		[onUpload],
	);

	const handlePlusDrop = useCallback(
		(e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const file = e.dataTransfer.files[0];
			if (file && file.type === "application/pdf") onUpload(file);
		},
		[onUpload],
	);

	const handleDragOver = useCallback((e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	if (documents.length === 0 && uploadingCount === 0) return null;

	const skeletonChips = Array.from({ length: uploadingCount });

	return (
		<div className="relative border-b border-neutral-100 bg-white">
			<div className="flex gap-2 overflow-x-auto px-3 py-2 scrollbar-thin">
				{documents.map((doc) => {
					const active = doc.id === activeDocumentId;
					const failed = doc.extraction_failed;
					return (
						<Tooltip key={doc.id}>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => onSelect(doc.id)}
									className={`inline-flex max-w-[260px] flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
										active
											? "border-neutral-900 bg-neutral-900 text-white"
											: "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
									}`}
								>
									{failed ? (
										<TriangleAlert className="h-3 w-3 flex-shrink-0 text-amber-500" />
									) : (
										<FileText
											className={`h-3 w-3 flex-shrink-0 ${active ? "text-white" : "text-neutral-400"}`}
										/>
									)}
									<span className="truncate font-medium">
										{stripExtension(doc.filename)}
									</span>
									<span
										className={`flex-shrink-0 ${active ? "text-neutral-300" : "text-neutral-400"}`}
									>
										· {doc.page_count}p
									</span>
								</button>
							</TooltipTrigger>
							<TooltipContent>
								{failed
									? "AI can't read this document — preview only"
									: doc.filename}
							</TooltipContent>
						</Tooltip>
					);
				})}

				{skeletonChips.map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: skeletons are ephemeral
						key={`skel-${i}`}
						className="inline-flex flex-shrink-0 animate-pulse items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-400"
					>
						<Loader2 className="h-3 w-3 animate-spin" />
						<span>Uploading…</span>
					</div>
				))}

				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							onDrop={handlePlusDrop}
							onDragOver={handleDragOver}
							className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-xs text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
						>
							<Plus className="h-3 w-3" />
							<span>Add</span>
						</button>
					</TooltipTrigger>
					<TooltipContent>Add a document</TooltipContent>
				</Tooltip>

				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf"
					className="hidden"
					onChange={handleFileChange}
				/>
			</div>
			<div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent" />
		</div>
	);
}

function stripExtension(filename: string): string {
	return filename.replace(/\.pdf$/i, "");
}
