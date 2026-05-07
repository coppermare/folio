import { Download, FileQuestion } from "lucide-react";
import { getDocumentUrl } from "../lib/api";
import type { ConversationDocument } from "../types";
import { PdfRenderer } from "./PdfRenderer";

interface DocumentViewerProps {
	document: ConversationDocument;
}

function detectKind(filename: string): "pdf" | "unknown" {
	const lower = filename.toLowerCase();
	if (lower.endsWith(".pdf")) return "pdf";
	return "unknown";
}

export function DocumentViewer({ document }: DocumentViewerProps) {
	const kind = detectKind(document.filename);

	if (kind === "pdf") {
		return <PdfRenderer documentId={document.id} />;
	}

	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center">
			<FileQuestion className="h-10 w-10 text-neutral-300" />
			<p className="text-sm text-neutral-500">
				Preview isn't available for this file type yet.
			</p>
			<a
				href={getDocumentUrl(document.id)}
				target="_blank"
				rel="noreferrer"
				className="inline-flex items-center gap-1.5 rounded-control border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
			>
				<Download className="h-3.5 w-3.5" />
				Download
			</a>
		</div>
	);
}
