interface EmptyStateProps {
	hasDocuments: boolean;
	userName?: string | null;
}

export function EmptyState({ hasDocuments, userName }: EmptyStateProps) {
	return (
		<div className="flex max-w-md flex-col items-center px-4 text-center">
			<img
				src="/symbol.svg"
				alt="Folio"
				className="mb-4 h-10 w-10 opacity-80"
			/>
			<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
				{userName
					? `Where to next, ${userName}?`
					: "Your legal documents, decoded."}
			</h1>
			{hasDocuments && (
				<p className="mt-3 max-w-sm text-sm text-neutral-500">
					Ask a question about your files. Use @ to reference a specific
					document.
				</p>
			)}
		</div>
	);
}
