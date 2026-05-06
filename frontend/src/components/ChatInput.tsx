import { Paperclip, SendHorizontal } from "lucide-react";
import {
	type ChangeEvent,
	type ClipboardEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	FILE_REF_MIME,
	decodeFileRef,
	onAddFileReference,
} from "../lib/chat-references";
import type { ConversationDocument } from "../types";
import {
	ChatAttachments,
	type PendingFile,
	type ReferenceChip,
} from "./ChatAttachments";
import { FileMentionPopover } from "./FileMentionPopover";
import { Button } from "./ui/button";

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

interface ChatInputProps {
	onSend: (
		content: string,
		attachments: { pending: File[]; referenceIds: string[] },
	) => void | Promise<void>;
	disabled: boolean;
	availableDocuments: ConversationDocument[];
	conversationId: string | null;
	ensureConversation: () => Promise<string | null>;
}

export function ChatInput({
	onSend,
	disabled,
	availableDocuments,
	conversationId,
	ensureConversation,
}: ChatInputProps) {
	const [value, setValue] = useState("");
	const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
	const [references, setReferences] = useState<ReferenceChip[]>([]);
	const [warning, setWarning] = useState<string | null>(null);
	const [mention, setMention] = useState<{ open: boolean; query: string }>({
		open: false,
		query: "",
	});

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const totalAttachments = pendingFiles.length + references.length;

	// Listen for "Reference in chat" actions from FileRow.
	useEffect(() => {
		return onAddFileReference((ref) => {
			setReferences((prev) =>
				prev.some((r) => r.id === ref.id) ? prev : [...prev, ref],
			);
			setWarning(null);
			textareaRef.current?.focus();
		});
	}, []);

	// Auto-clear warning after a moment.
	useEffect(() => {
		if (!warning) return;
		const t = setTimeout(() => setWarning(null), 3000);
		return () => clearTimeout(t);
	}, [warning]);

	const addReference = useCallback(
		(ref: ReferenceChip) => {
			setReferences((prev) => {
				if (prev.some((r) => r.id === ref.id)) return prev;
				if (prev.length + pendingFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
					setWarning(
						`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`,
					);
					return prev;
				}
				return [...prev, ref];
			});
		},
		[pendingFiles.length],
	);

	const addPendingFiles = useCallback(
		(files: File[]) => {
			const filtered = files.filter((f) =>
				f.name.toLowerCase().endsWith(".pdf"),
			);
			if (filtered.length !== files.length) {
				setWarning("Only PDF files are supported.");
			}
			setPendingFiles((prev) => {
				const room =
					MAX_ATTACHMENTS_PER_MESSAGE - prev.length - references.length;
				if (room <= 0) {
					setWarning(
						`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`,
					);
					return prev;
				}
				if (filtered.length > room) {
					setWarning(
						`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message. ${filtered.length - room} skipped.`,
					);
				}
				const accepted = filtered.slice(0, room).map((file) => ({
					id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
					file,
				}));
				return [...prev, ...accepted];
			});
		},
		[references.length],
	);

	const handleFileChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files ? Array.from(e.target.files) : [];
			if (files.length > 0) addPendingFiles(files);
			if (fileInputRef.current) fileInputRef.current.value = "";
		},
		[addPendingFiles],
	);

	const handlePaste = useCallback(
		(e: ClipboardEvent<HTMLTextAreaElement>) => {
			const refRaw = e.clipboardData.getData(FILE_REF_MIME);
			if (refRaw) {
				const decoded = decodeFileRef(refRaw);
				if (decoded) {
					e.preventDefault();
					addReference(decoded);
					return;
				}
			}
			const files = Array.from(e.clipboardData.files ?? []);
			if (files.length > 0) {
				e.preventDefault();
				addPendingFiles(files);
			}
		},
		[addReference, addPendingFiles],
	);

	const handleSendRef = useRef<() => Promise<void>>(async () => {});

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (mention.open) {
				if (e.key === "Escape") {
					e.preventDefault();
					setMention({ open: false, query: "" });
					return;
				}
			}
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void handleSendRef.current();
			}
		},
		[mention.open],
	);

	const handleInput = useCallback(() => {
		const ta = textareaRef.current;
		if (!ta) return;
		ta.style.height = "auto";
		ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;

		// Detect "@" trigger: an @ token at the cursor that isn't attached to a
		// preceding word character.
		const cursor = ta.selectionStart ?? ta.value.length;
		const upToCursor = ta.value.slice(0, cursor);
		const match = /(^|\s)@([\w\-. ]*)$/.exec(upToCursor);
		if (match) {
			setMention({ open: true, query: match[2] ?? "" });
		} else {
			setMention((prev) => (prev.open ? { open: false, query: "" } : prev));
		}
	}, []);

	const insertReferenceAtCursor = useCallback(
		(doc: ConversationDocument) => {
			const ta = textareaRef.current;
			if (ta) {
				const cursor = ta.selectionStart ?? ta.value.length;
				const upToCursor = ta.value.slice(0, cursor);
				const match = /(^|\s)@([\w\-. ]*)$/.exec(upToCursor);
				if (match) {
					const start = cursor - match[0].length + (match[1] ? 1 : 0);
					const next = ta.value.slice(0, start) + ta.value.slice(cursor);
					setValue(next);
					queueMicrotask(() => {
						if (textareaRef.current) {
							textareaRef.current.value = next;
							textareaRef.current.selectionStart = start;
							textareaRef.current.selectionEnd = start;
						}
					});
				}
			}
			addReference({ id: doc.id, filename: doc.filename });
			setMention({ open: false, query: "" });
		},
		[addReference],
	);

	const handleSend = useCallback(async () => {
		const trimmed = value.trim();
		if (disabled) return;
		if (!trimmed && pendingFiles.length === 0 && references.length === 0) {
			return;
		}
		// Ensure a conversation exists before sending.
		const cid = await ensureConversation();
		if (!cid) return;
		await onSend(trimmed, {
			pending: pendingFiles.map((p) => p.file),
			referenceIds: references.map((r) => r.id),
		});
		setValue("");
		setPendingFiles([]);
		setReferences([]);
		setMention({ open: false, query: "" });
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	}, [value, disabled, pendingFiles, references, onSend, ensureConversation]);

	useEffect(() => {
		handleSendRef.current = handleSend;
	}, [handleSend]);

	const placeholder =
		availableDocuments.length === 0
			? "Attach a PDF or ask a question..."
			: "Ask a question — type @ to reference a file";

	const canSend =
		!disabled &&
		(value.trim().length > 0 ||
			pendingFiles.length > 0 ||
			references.length > 0);

	return (
		<div className="border-t border-neutral-200 bg-white">
			<div className="relative p-3">
				<div className="rounded-xl border border-neutral-200 bg-neutral-50">
					<ChatAttachments
						pendingFiles={pendingFiles}
						references={references}
						onRemovePending={(id) =>
							setPendingFiles((prev) => prev.filter((p) => p.id !== id))
						}
						onRemoveReference={(id) =>
							setReferences((prev) => prev.filter((r) => r.id !== id))
						}
					/>

					<div className="flex items-end gap-2 px-3 py-2">
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 flex-shrink-0"
							onClick={() => fileInputRef.current?.click()}
							disabled={
								disabled || totalAttachments >= MAX_ATTACHMENTS_PER_MESSAGE
							}
							aria-label="Attach files"
						>
							<Paperclip className="h-4 w-4 text-neutral-500" />
						</Button>

						<input
							ref={fileInputRef}
							type="file"
							accept=".pdf"
							multiple
							className="hidden"
							onChange={handleFileChange}
						/>

						<textarea
							ref={textareaRef}
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onInput={handleInput}
							onKeyDown={handleKeyDown}
							onPaste={handlePaste}
							placeholder={placeholder}
							rows={1}
							className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none"
							disabled={disabled}
						/>

						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 flex-shrink-0"
							disabled={!canSend}
							onClick={() => void handleSend()}
						>
							<SendHorizontal
								className={`h-4 w-4 ${
									canSend ? "text-neutral-900" : "text-neutral-300"
								}`}
							/>
						</Button>
					</div>
				</div>

				{mention.open && (
					<FileMentionPopover
						query={mention.query}
						documents={availableDocuments}
						excludeIds={references.map((r) => r.id)}
						onPick={insertReferenceAtCursor}
						onClose={() => setMention({ open: false, query: "" })}
					/>
				)}
			</div>

			{warning && <p className="px-4 pb-2 text-xs text-red-500">{warning}</p>}
			<p className="px-4 pb-2 text-[11px] text-neutral-400">
				{totalAttachments}/{MAX_ATTACHMENTS_PER_MESSAGE} attachments
				{conversationId === null && totalAttachments === 0
					? " · sending starts a new conversation"
					: ""}
			</p>
		</div>
	);
}
