import { useCallback, useEffect, useState } from "react";
import { emitToast } from "../components/Toaster";
import * as api from "../lib/api";
import type { ConversationDocument } from "../types";

export function useDocuments(conversationId: string | null) {
	const [documents, setDocuments] = useState<ConversationDocument[]>([]);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (!conversationId) {
			setDocuments([]);
			return;
		}
		try {
			setError(null);
			const detail = await api.fetchConversation(conversationId);
			setDocuments(detail.documents);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load documents");
		}
	}, [conversationId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const upload = useCallback(
		async (file: File): Promise<ConversationDocument | null> => {
			if (!conversationId) return null;
			try {
				setUploading(true);
				setError(null);
				const result = await api.uploadDocument(conversationId, file);
				const doc = result.document;
				const summary: ConversationDocument = {
					id: doc.id,
					filename: doc.filename,
					page_count: doc.page_count,
					uploaded_at: doc.uploaded_at,
					extraction_failed: doc.extraction_failed,
				};
				if (result.duplicate) {
					emitToast(
						`"${doc.filename}" is already attached to this conversation.`,
					);
				}
				setDocuments((prev) =>
					result.duplicate || prev.some((d) => d.id === summary.id)
						? prev
						: [...prev, summary],
				);
				return summary;
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to upload document",
				);
				return null;
			} finally {
				setUploading(false);
			}
		},
		[conversationId],
	);

	const uploadMany = useCallback(
		async (files: File[]): Promise<ConversationDocument[]> => {
			const results = await Promise.all(files.map((f) => upload(f)));
			return results.filter((d): d is ConversationDocument => d !== null);
		},
		[upload],
	);

	const remove = useCallback(async (documentId: string) => {
		try {
			await api.deleteDocument(documentId);
			setDocuments((prev) => prev.filter((d) => d.id !== documentId));
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to delete document",
			);
		}
	}, []);

	return {
		documents,
		uploading,
		error,
		upload,
		uploadMany,
		remove,
		refresh,
	};
}
