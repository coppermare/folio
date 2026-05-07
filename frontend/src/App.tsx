import { useCallback } from "react";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { TooltipProvider } from "./components/ui/tooltip";
import { useConversations } from "./hooks/use-conversations";
import { useDocuments } from "./hooks/use-documents";
import { useMessages } from "./hooks/use-messages";

export default function App() {
	const {
		conversations,
		selected,
		selectedId,
		loading: conversationsLoading,
		create,
		select,
		rename,
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
		uploading,
		uploadMany,
		remove: removeDocument,
		refresh: refreshDocuments,
	} = useDocuments(selectedId);

	const handleSend = useCallback(
		async (
			content: string,
			documentIds?: string[],
			overrideConversationId?: string,
		) => {
			await send(content, documentIds, overrideConversationId);
			refreshConversations();
		},
		[send, refreshConversations],
	);

	const handleUpload = useCallback(
		async (files: File[]) => {
			const uploaded = await uploadMany(files);
			if (uploaded.length > 0) {
				refreshConversations();
			}
			return uploaded;
		},
		[uploadMany, refreshConversations],
	);

	const handleRemoveDocument = useCallback(
		async (id: string) => {
			await removeDocument(id);
			refreshConversations();
		},
		[removeDocument, refreshConversations],
	);

	const handleCreate = useCallback(async () => {
		await create();
	}, [create]);

	const ensureConversation = useCallback(async () => {
		if (selectedId) return selectedId;
		const created = await create();
		if (created) {
			// useDocuments and useMessages re-bind via the new selectedId effect.
			refreshDocuments();
		}
		return created?.id ?? null;
	}, [create, selectedId, refreshDocuments]);

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex h-screen bg-neutral-50">
				<ChatSidebar
					conversations={conversations}
					selectedId={selectedId}
					loading={conversationsLoading}
					onSelect={select}
					onCreate={handleCreate}
					onRename={rename}
					onDelete={remove}
				/>

				<ChatWindow
					messages={messages}
					loading={messagesLoading}
					error={messagesError}
					streaming={streaming}
					streamingContent={streamingContent}
					hasDocuments={documents.length > 0}
					conversationId={selectedId}
					conversation={selected}
					documents={documents}
					ensureConversation={ensureConversation}
					onSend={handleSend}
					onUpload={handleUpload}
					onRename={rename}
					onDelete={remove}
				/>

				<WorkspacePanel
					conversationId={selectedId}
					documents={documents}
					uploading={uploading}
					onUpload={handleUpload}
					onRemove={handleRemoveDocument}
				/>
			</div>
		</TooltipProvider>
	);
}
