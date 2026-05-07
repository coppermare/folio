interface EmptyStateProps {
	hasDocuments: boolean;
}

export function EmptyState({ hasDocuments }: EmptyStateProps) {
	return (
		<div className="flex max-w-md flex-col items-center px-4 text-center">
			<h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
				Folio
			</h1>
			<p className="mt-2 max-w-md text-base text-neutral-500">
				{hasDocuments
					? "Ask a question about your files. Use @ to reference a specific document."
					: "Ask a question below, or attach a PDF to get started."}
			</p>
		</div>
	);
}
