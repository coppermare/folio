import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import * as api from "../lib/api";
import type { Conversation, ConversationDocument, Message } from "../types";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { MessageBubble, StreamingBubble } from "./MessageBubble";

interface ChatWindowProps {
	messages: Message[];
	loading: boolean;
	error: string | null;
	streaming: boolean;
	streamingContent: string;
	hasDocuments: boolean;
	conversationId: string | null;
	conversation: Conversation | null;
	documents: ConversationDocument[];
	ensureConversation: () => Promise<string | null>;
	onSend: (
		content: string,
		documentIds?: string[],
		overrideConversationId?: string,
	) => void | Promise<void>;
	onUpload: (files: File[]) => Promise<{ id: string; filename: string }[]>;
	onRename: (id: string, title: string) => Promise<void>;
	onDelete: (id: string) => Promise<void> | void;
}

export function ChatWindow({
	messages,
	loading,
	error,
	streaming,
	streamingContent,
	hasDocuments,
	conversationId,
	conversation,
	documents,
	ensureConversation,
	onSend,
	onUpload,
	onRename,
	onDelete,
}: ChatWindowProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	const messagesLength = messages.length;
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages and streamingContent are intentional triggers for auto-scroll
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messagesLength, streamingContent]);

	const handleSend = useCallback(
		async (
			content: string,
			attachments: { pending: File[]; referenceIds: string[] },
		) => {
			// Ensure we have a conversation before any uploads happen.
			const cid = await ensureConversation();
			if (!cid) return;

			// Upload pending files in parallel against this conversation.
			let uploadedIds: string[] = [];
			if (attachments.pending.length > 0) {
				// Use the parent-provided onUpload when conversation ids match;
				// otherwise upload directly so we land them in the freshly created one.
				if (cid === conversationId) {
					const uploaded = await onUpload(attachments.pending);
					uploadedIds = uploaded.map((u) => u.id);
				} else {
					const results = await Promise.all(
						attachments.pending.map((f) => api.uploadDocument(cid, f)),
					);
					uploadedIds = results.map((r) => r.id);
				}
			}
			const documentIds = [...attachments.referenceIds, ...uploadedIds];
			await onSend(
				content,
				documentIds.length > 0 ? documentIds : undefined,
				cid,
			);
		},
		[conversationId, ensureConversation, onSend, onUpload],
	);

	const isEmpty = !loading && messages.length === 0 && !streaming;

	return (
		<div className="flex min-w-0 flex-1 flex-col bg-white">
			{conversation && (
				<ChatHeader
					conversation={conversation}
					onRename={onRename}
					onDelete={onDelete}
				/>
			)}

			{loading ? (
				<div className="flex flex-1 items-center justify-center">
					<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
				</div>
			) : isEmpty ? (
				<div className="flex flex-1 items-center justify-center">
					<EmptyState hasDocuments={hasDocuments} />
				</div>
			) : (
				<>
					{error && (
						<div className="mx-4 mt-2 rounded-control bg-red-50 px-4 py-2 text-sm text-red-600">
							{error}
						</div>
					)}
					<div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
						<div className="mx-auto max-w-2xl space-y-1">
							{messages.map((message) => (
								<MessageBubble key={message.id} message={message} />
							))}
							{streaming && <StreamingBubble content={streamingContent} />}
						</div>
					</div>
				</>
			)}

			<ChatInput
				onSend={handleSend}
				disabled={streaming}
				availableDocuments={documents}
			/>
		</div>
	);
}
