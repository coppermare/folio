import { useCallback, useEffect, useState } from "react";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { DocumentViewer } from "./components/DocumentViewer";
import { TooltipProvider } from "./components/ui/tooltip";
import { useConversations } from "./hooks/use-conversations";
import { useDocuments } from "./hooks/use-documents";
import { useMessages } from "./hooks/use-messages";

export default function App() {
	const {
		conversations,
		selectedId,
		loading: conversationsLoading,
		create,
		select,
		remove,
		refresh: refreshConversations,
	} = useConversations();

	const {
		messages,
		loading: messagesLoading,
		error: messagesError,
		streaming,
		streamingContent,
		send,
	} = useMessages(selectedId);

	const {
		documents,
		activeDocumentId,
		setActiveDocumentId,
		uploadingCount,
		upload,
	} = useDocuments(selectedId);

	const [toast, setToast] = useState<string | null>(null);
	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 3000);
		return () => window.clearTimeout(timer);
	}, [toast]);

	const handleSend = useCallback(
		async (content: string) => {
			await send(content);
			refreshConversations();
		},
		[send, refreshConversations],
	);

	const handleUpload = useCallback(
		async (file: File) => {
			const outcome = await upload(file);
			if (!outcome) return;
			if (outcome.duplicate) {
				setToast(`"${outcome.document.filename}" is already in this conversation`);
			} else {
				refreshConversations();
			}
		},
		[upload, refreshConversations],
	);

	const handleCreate = useCallback(async () => {
		await create();
	}, [create]);

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex h-screen bg-neutral-50">
				<ChatSidebar
					conversations={conversations}
					selectedId={selectedId}
					loading={conversationsLoading}
					onSelect={select}
					onCreate={handleCreate}
					onDelete={remove}
				/>

				<ChatWindow
					messages={messages}
					loading={messagesLoading}
					error={messagesError}
					streaming={streaming}
					streamingContent={streamingContent}
					documents={documents}
					activeDocumentId={activeDocumentId}
					uploadingCount={uploadingCount}
					conversationId={selectedId}
					onSend={handleSend}
					onUpload={handleUpload}
					onSelectDocument={setActiveDocumentId}
				/>

				<DocumentViewer
					documents={documents}
					activeDocumentId={activeDocumentId}
					onSelect={setActiveDocumentId}
				/>

				{toast && (
					<div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">
						{toast}
					</div>
				)}
			</div>
		</TooltipProvider>
	);
}
