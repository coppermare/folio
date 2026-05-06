import { Loader2 } from "lucide-react";
import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Document, Message } from "../types";
import { ChatInput } from "./ChatInput";
import { DocStrip } from "./DocStrip";
import { EmptyState } from "./EmptyState";
import { MessageBubble, StreamingBubble } from "./MessageBubble";

interface ChatWindowProps {
	messages: Message[];
	loading: boolean;
	error: string | null;
	streaming: boolean;
	streamingContent: string;
	documents: Document[];
	activeDocumentId: string | null;
	uploadingCount: number;
	conversationId: string | null;
	onSend: (content: string) => void;
	onUpload: (file: File) => void;
	onSelectDocument: (id: string) => void;
}

export function ChatWindow({
	messages,
	loading,
	error,
	streaming,
	streamingContent,
	documents,
	activeDocumentId,
	uploadingCount,
	conversationId,
	onSend,
	onUpload,
	onSelectDocument,
}: ChatWindowProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [dragDepth, setDragDepth] = useState(0);

	const messagesLength = messages.length;
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages and streamingContent are intentional triggers for auto-scroll
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messagesLength, streamingContent]);

	const containsFiles = useCallback((e: DragEvent) => {
		return Array.from(e.dataTransfer?.types ?? []).includes("Files");
	}, []);

	const handleDragEnter = useCallback(
		(e: DragEvent) => {
			if (!conversationId || !containsFiles(e)) return;
			e.preventDefault();
			setDragDepth((d) => d + 1);
		},
		[conversationId, containsFiles],
	);

	const handleDragLeave = useCallback(
		(e: DragEvent) => {
			if (!conversationId || !containsFiles(e)) return;
			e.preventDefault();
			setDragDepth((d) => Math.max(0, d - 1));
		},
		[conversationId, containsFiles],
	);

	const handleDragOver = useCallback(
		(e: DragEvent) => {
			if (!conversationId || !containsFiles(e)) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "copy";
		},
		[conversationId, containsFiles],
	);

	const handleDrop = useCallback(
		(e: DragEvent) => {
			if (!conversationId) return;
			e.preventDefault();
			setDragDepth(0);
			const file = e.dataTransfer.files[0];
			if (file && file.type === "application/pdf") onUpload(file);
		},
		[conversationId, onUpload],
	);

	if (!conversationId) {
		return (
			<div className="flex flex-1 items-center justify-center bg-neutral-50">
				<div className="text-center">
					<p className="text-sm text-neutral-400">
						Select a conversation or create a new one
					</p>
				</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="flex flex-1 items-center justify-center bg-white">
				<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
			</div>
		);
	}

	const hasDocuments = documents.length > 0;
	const showOverlay = dragDepth > 0 && hasDocuments;

	if (messages.length === 0 && !streaming && !hasDocuments && uploadingCount === 0) {
		return (
			<div className="flex flex-1 flex-col bg-white">
				<div className="flex flex-1 items-center justify-center">
					<EmptyState onUpload={onUpload} uploading={false} />
				</div>
				<ChatInput
					onSend={onSend}
					disabled={!hasDocuments || streaming}
					placeholder="Upload a document to start"
				/>
			</div>
		);
	}

	return (
		<div
			className="relative flex flex-1 flex-col bg-white"
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<DocStrip
				documents={documents}
				activeDocumentId={activeDocumentId}
				uploadingCount={uploadingCount}
				onSelect={onSelectDocument}
				onUpload={onUpload}
			/>

			{error && (
				<div className="mx-4 mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
					{error}
				</div>
			)}

			<div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
				<div className="mx-auto max-w-2xl space-y-1">
					{messages.length === 0 && !streaming && hasDocuments && (
						<div className="flex h-full items-center justify-center py-16">
							<p className="text-sm text-neutral-500">
								{documents.length === 1
									? "Document uploaded. Ask a question to get started."
									: `${documents.length} documents loaded. Ask a question across any of them.`}
							</p>
						</div>
					)}
					{messages.map((message) => (
						<MessageBubble
							key={message.id}
							message={message}
							documentCount={documents.length}
							documents={documents}
						/>
					))}
					{streaming && <StreamingBubble content={streamingContent} />}
				</div>
			</div>

			<ChatInput
				onSend={onSend}
				disabled={!hasDocuments || streaming}
				placeholder={
					hasDocuments
						? "Ask a question about your documents..."
						: "Upload a document to start"
				}
			/>

			{showOverlay && (
				<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-neutral-900/5 backdrop-blur-[1px]">
					<div className="rounded-xl border-2 border-dashed border-neutral-400 bg-white/90 px-8 py-6 text-center shadow-lg">
						<p className="text-sm font-medium text-neutral-700">
							Drop PDF to add to this conversation
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
