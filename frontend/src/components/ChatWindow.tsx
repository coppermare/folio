import { Files, Loader2, Menu, Upload } from "lucide-react";
import {
	type DragEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import * as api from "../lib/api";
import type {
	Citation,
	Conversation,
	ConversationDocument,
	Message,
} from "../types";
import { ChatHeader } from "./ChatHeader";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { Button } from "./ui/button";

function dragHasFiles(e: DragEvent<HTMLDivElement>): boolean {
	return Array.from(e.dataTransfer.types ?? []).includes("Files");
}

function MobileEmptyHeader({
	onOpenSidebar,
	onOpenWorkspace,
	documentsCount,
}: {
	onOpenSidebar?: () => void;
	onOpenWorkspace?: () => void;
	documentsCount: number;
}) {
	return (
		<div className="flex h-10 flex-shrink-0 items-center gap-2 bg-gradient-to-b from-white to-transparent px-3 lg:hidden">
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 flex-shrink-0"
				onClick={onOpenSidebar}
				aria-label="Open conversations"
			>
				<Menu className="h-4 w-4 text-neutral-600" />
			</Button>
			<span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800">
				Folio
			</span>
			<Button
				variant="ghost"
				size="icon"
				className="relative h-8 w-8 flex-shrink-0"
				onClick={onOpenWorkspace}
				aria-label="Open workspace"
			>
				<Files className="h-4 w-4 text-neutral-600" />
				{documentsCount > 0 && (
					<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-medium text-white">
						{documentsCount}
					</span>
				)}
			</Button>
		</div>
	);
}

interface ChatWindowProps {
	messages: Message[];
	loading: boolean;
	error: string | null;
	streaming: boolean;
	streamingContent: string;
	streamingSources: Citation[];
	streamingReasoning: string;
	hasDocuments: boolean;
	userName?: string | null;
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
	onStop: () => void;
	onRename: (id: string, title: string) => Promise<void>;
	onDelete: (id: string) => Promise<void> | void;
	isMobile?: boolean;
	documentsCount?: number;
	onOpenSidebar?: () => void;
	onOpenWorkspace?: () => void;
}

export function ChatWindow({
	messages,
	loading,
	error,
	streaming,
	streamingContent,
	streamingSources,
	streamingReasoning,
	hasDocuments,
	userName,
	conversationId,
	conversation,
	documents,
	ensureConversation,
	onSend,
	onUpload,
	onStop,
	onRename,
	onDelete,
	isMobile = false,
	documentsCount = 0,
	onOpenSidebar,
	onOpenWorkspace,
}: ChatWindowProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<ChatInputHandle>(null);
	const dragCounter = useRef(0);
	const [isDragging, setIsDragging] = useState(false);

	const handleDragEnter = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!dragHasFiles(e)) return;
			e.preventDefault();
			dragCounter.current += 1;
			if (!streaming) setIsDragging(true);
		},
		[streaming],
	);

	const handleDragOver = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!dragHasFiles(e)) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = streaming ? "none" : "copy";
		},
		[streaming],
	);

	const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		if (!dragHasFiles(e)) return;
		e.preventDefault();
		dragCounter.current = Math.max(0, dragCounter.current - 1);
		if (dragCounter.current === 0) setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!dragHasFiles(e)) return;
			e.preventDefault();
			dragCounter.current = 0;
			setIsDragging(false);
			if (streaming) return;
			const files = Array.from(e.dataTransfer.files ?? []);
			if (files.length > 0) inputRef.current?.addFiles(files);
		},
		[streaming],
	);

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
					uploadedIds = results.map((r) => r.document.id);
				}
			}
			const documentIds = Array.from(
				new Set([...attachments.referenceIds, ...uploadedIds]),
			);
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
		<div
			className="relative flex min-w-0 flex-1 flex-col bg-white lg:min-w-[360px]"
			onDragEnter={handleDragEnter}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{isDragging && (
				<div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-white/85">
					<Upload className="h-6 w-6 text-neutral-500" />
					<span className="text-sm font-medium text-neutral-700">
						Drop files to attach
					</span>
				</div>
			)}
			{conversation ? (
				<ChatHeader
					conversation={conversation}
					onRename={onRename}
					onDelete={onDelete}
					isMobile={isMobile}
					documentsCount={documentsCount}
					onOpenSidebar={onOpenSidebar}
					onOpenWorkspace={onOpenWorkspace}
				/>
			) : isMobile ? (
				<MobileEmptyHeader
					onOpenSidebar={onOpenSidebar}
					onOpenWorkspace={onOpenWorkspace}
					documentsCount={documentsCount}
				/>
			) : null}

			{loading ? (
				<div className="flex flex-1 items-center justify-center">
					<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
				</div>
			) : isEmpty ? (
				<div className="flex flex-1 items-center justify-center">
					<EmptyState hasDocuments={hasDocuments} userName={userName ?? null} />
				</div>
			) : (
				<>
					{error && (
						<div className="mx-4 mt-2 rounded-control bg-red-50 px-4 py-2 text-sm text-red-600">
							{error}
						</div>
					)}
					<div
						ref={scrollRef}
						className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-4"
					>
						<div className="mx-auto max-w-3xl space-y-1">
							{messages.map((message) => (
								<MessageBubble
									key={message.id}
									message={message}
									documents={documents}
								/>
							))}
							{streaming && (
								<StreamingBubble
									content={streamingContent}
									documents={documents}
									sources={streamingSources}
									reasoning={streamingReasoning}
								/>
							)}
						</div>
					</div>
				</>
			)}

			<ChatInput
				ref={inputRef}
				onSend={handleSend}
				streaming={streaming}
				onStop={onStop}
				availableDocuments={documents}
			/>
		</div>
	);
}
