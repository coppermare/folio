import { FileSearch } from "lucide-react";

interface EmptyStateProps {
	hasDocuments: boolean;
}

export function EmptyState({ hasDocuments }: EmptyStateProps) {
	return (
		<div className="flex max-w-md flex-col items-center px-4 text-center">
			<div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900">
				<FileSearch className="h-7 w-7 text-white" />
			</div>
			<h2 className="mb-2 text-lg font-semibold text-neutral-800">
				{hasDocuments
					? "Ask a question about your files"
					: "Attach a document to get started"}
			</h2>
			<p className="text-sm text-neutral-500">
				{hasDocuments
					? "Use @ to reference a specific file, or attach more files with the paperclip below."
					: "Drop a PDF in the Files panel on the right, or attach one in the chat. The Files panel keeps everything you've uploaded for this conversation."}
			</p>
		</div>
	);
}
