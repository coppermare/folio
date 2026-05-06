import { useCallback, useEffect, useState } from "react";
import * as api from "../lib/api";
import type { Document } from "../types";

export interface UploadOutcome {
	document: Document;
	duplicate: boolean;
}

export function useDocuments(conversationId: string | null) {
	const [documents, setDocuments] = useState<Document[]>([]);
	const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
	const [uploadingCount, setUploadingCount] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (!conversationId) {
			setDocuments([]);
			setActiveDocumentId(null);
			return;
		}
		try {
			setError(null);
			const docs = await api.fetchDocuments(conversationId);
			setDocuments(docs);
			setActiveDocumentId((current) => {
				if (current && docs.some((d) => d.id === current)) return current;
				return docs.length > 0 ? docs[0].id : null;
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load documents");
		}
	}, [conversationId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const upload = useCallback(
		async (file: File): Promise<UploadOutcome | null> => {
			if (!conversationId) return null;
			try {
				setUploadingCount((c) => c + 1);
				setError(null);
				const result = await api.uploadDocument(conversationId, file);
				setDocuments((prev) => {
					if (prev.some((d) => d.id === result.document.id)) return prev;
					return [...prev, result.document];
				});
				setActiveDocumentId((current) => current ?? result.document.id);
				return result;
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to upload document",
				);
				return null;
			} finally {
				setUploadingCount((c) => Math.max(0, c - 1));
			}
		},
		[conversationId],
	);

	const activeDocument =
		documents.find((d) => d.id === activeDocumentId) ?? null;

	return {
		documents,
		activeDocument,
		activeDocumentId,
		setActiveDocumentId,
		uploading: uploadingCount > 0,
		uploadingCount,
		error,
		upload,
		refresh,
	};
}
