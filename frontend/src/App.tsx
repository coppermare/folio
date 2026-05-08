import { useCallback, useEffect, useState } from "react";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { OnboardingModal } from "./components/OnboardingModal";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { TooltipProvider } from "./components/ui/tooltip";
import { useConversations } from "./hooks/use-conversations";
import { useDocuments } from "./hooks/use-documents";
import { useIsMobile } from "./hooks/use-is-mobile";
import { useMessages } from "./hooks/use-messages";
import { useUserPreferences } from "./hooks/use-user-preferences";

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
		streamingSources,
		streamingReasoning,
		send,
	} = useMessages(selectedId);

	const {
		documents,
		uploading,
		uploadMany,
		remove: removeDocument,
		refresh: refreshDocuments,
	} = useDocuments(selectedId);

	const { userName, setUserName, hasCompletedOnboarding, completeOnboarding } =
		useUserPreferences();

	const handleOnboardingComplete = useCallback(
		(name: string | null) => {
			setUserName(name);
			completeOnboarding();
		},
		[setUserName, completeOnboarding],
	);

	const isMobile = useIsMobile();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [workspaceOpen, setWorkspaceOpen] = useState(false);

	useEffect(() => {
		if (!isMobile) {
			setSidebarOpen(false);
			setWorkspaceOpen(false);
		}
	}, [isMobile]);

	useEffect(() => {
		const handler = () => {
			if (isMobile) setWorkspaceOpen(true);
		};
		window.addEventListener("folio:open-workspace", handler);
		return () => window.removeEventListener("folio:open-workspace", handler);
	}, [isMobile]);

	const handleSend = useCallback(
		async (
			content: string,
			documentIds?: string[],
			overrideConversationId?: string,
		) => {
			await send(content, documentIds, overrideConversationId, userName);
			refreshConversations();
		},
		[send, refreshConversations, userName],
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
		if (isMobile) setSidebarOpen(false);
	}, [create, isMobile]);

	const handleSelect = useCallback(
		(id: string) => {
			select(id);
			if (isMobile) setSidebarOpen(false);
		},
		[select, isMobile],
	);

	const ensureConversation = useCallback(async () => {
		if (selectedId) return selectedId;
		const created = await create();
		if (created) {
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
					onSelect={handleSelect}
					onCreate={handleCreate}
					onRename={rename}
					onDelete={remove}
					isMobile={isMobile}
					mobileOpen={sidebarOpen}
					onMobileClose={() => setSidebarOpen(false)}
				/>

				<ChatWindow
					messages={messages}
					loading={messagesLoading}
					error={messagesError}
					streaming={streaming}
					streamingContent={streamingContent}
					streamingSources={streamingSources}
					streamingReasoning={streamingReasoning}
					hasDocuments={documents.length > 0}
					userName={userName}
					conversationId={selectedId}
					conversation={selected}
					documents={documents}
					ensureConversation={ensureConversation}
					onSend={handleSend}
					onUpload={handleUpload}
					onRename={rename}
					onDelete={remove}
					isMobile={isMobile}
					documentsCount={documents.length}
					onOpenSidebar={() => setSidebarOpen(true)}
					onOpenWorkspace={() => setWorkspaceOpen(true)}
				/>

				<WorkspacePanel
					conversationId={selectedId}
					documents={documents}
					uploading={uploading}
					onUpload={handleUpload}
					onRemove={handleRemoveDocument}
					isMobile={isMobile}
					mobileOpen={workspaceOpen}
					onMobileClose={() => setWorkspaceOpen(false)}
				/>
			</div>
			<OnboardingModal
				open={!hasCompletedOnboarding}
				onComplete={handleOnboardingComplete}
			/>
		</TooltipProvider>
	);
}
