import { ArrowUp, Plus } from "lucide-react";
import {
	type ChangeEvent,
	type ClipboardEvent,
	type DragEvent,
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
import {
	SUPPORTED_UPLOAD_ACCEPT,
	UNSUPPORTED_FILE_WARNING,
	isSupportedUploadFile,
} from "../lib/uploads";
import type { ConversationDocument } from "../types";
import {
	ChatAttachments,
	type PendingFile,
	type ReferenceChip,
} from "./ChatAttachments";
import { FileMentionPopover } from "./FileMentionPopover";
import { Button } from "./ui/button";

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

function hasFiles(e: DragEvent<HTMLDivElement>): boolean {
	return Array.from(e.dataTransfer.types ?? []).includes("Files");
}

interface ChatInputProps {
	onSend: (
		content: string,
		attachments: { pending: File[]; referenceIds: string[] },
	) => void | Promise<void>;
	disabled: boolean;
	availableDocuments: ConversationDocument[];
}

export function ChatInput({
	onSend,
	disabled,
	availableDocuments,
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
	const dragCounter = useRef(0);
	const [isDragging, setIsDragging] = useState(false);

	const totalAttachments = pendingFiles.length + references.length;
	const dropDisabled =
		disabled || totalAttachments >= MAX_ATTACHMENTS_PER_MESSAGE;

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
			const filtered = files.filter((f) => isSupportedUploadFile(f.name));
			if (filtered.length !== files.length) {
				setWarning(UNSUPPORTED_FILE_WARNING);
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

	const handleDragEnter = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			e.stopPropagation();
			dragCounter.current += 1;
			if (!dropDisabled) setIsDragging(true);
		},
		[dropDisabled],
	);

	const handleDragOver = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			e.stopPropagation();
			e.dataTransfer.dropEffect = dropDisabled ? "none" : "copy";
		},
		[dropDisabled],
	);

	const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		if (!hasFiles(e)) return;
		e.preventDefault();
		e.stopPropagation();
		dragCounter.current = Math.max(0, dragCounter.current - 1);
		if (dragCounter.current === 0) setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			e.stopPropagation();
			dragCounter.current = 0;
			setIsDragging(false);
			if (dropDisabled) return;
			const files = Array.from(e.dataTransfer.files ?? []);
			if (files.length > 0) addPendingFiles(files);
		},
		[dropDisabled, addPendingFiles],
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
		ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;

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
		const snapshot = {
			pending: pendingFiles.map((p) => p.file),
			referenceIds: references.map((r) => r.id),
		};
		// Clear the input synchronously so the user sees the textarea empty the
		// instant they hit send. The actual send + streaming happens in the
		// background via onSend (ChatWindow.handleSend ensures the conversation
		// exists before dispatching).
		setValue("");
		setPendingFiles([]);
		setReferences([]);
		setMention({ open: false, query: "" });
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
		void onSend(trimmed, snapshot);
	}, [value, disabled, pendingFiles, references, onSend]);

	useEffect(() => {
		handleSendRef.current = handleSend;
	}, [handleSend]);

	const placeholder =
		availableDocuments.length === 0
			? "Ask a question or attach a document..."
			: "Ask a question — type @ to reference a file";

	const canSend =
		!disabled &&
		(value.trim().length > 0 ||
			pendingFiles.length > 0 ||
			references.length > 0);

	return (
		<div className="px-3 pb-3 md:px-6 md:pb-4">
			<div
				className="relative mx-auto max-w-3xl"
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				<div className="relative rounded-3xl border border-neutral-200 bg-white shadow-md">
					{isDragging && (
						<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-neutral-400 bg-white/90">
							<span className="text-sm font-medium text-neutral-600">
								Drop files to attach
							</span>
						</div>
					)}
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

					<div className="px-3 pt-3 pb-2">
						<textarea
							ref={textareaRef}
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onInput={handleInput}
							onKeyDown={handleKeyDown}
							onPaste={handlePaste}
							placeholder={placeholder}
							rows={1}
							className="max-h-[240px] w-full resize-none bg-transparent py-0 text-sm leading-5 text-neutral-800 placeholder-neutral-400 outline-none"
							disabled={disabled}
						/>

						<div className="flex items-center justify-between pt-1">
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 flex-shrink-0 rounded-full"
								onClick={() => fileInputRef.current?.click()}
								disabled={
									disabled || totalAttachments >= MAX_ATTACHMENTS_PER_MESSAGE
								}
								aria-label="Attach files"
							>
								<Plus className="h-4 w-4 text-neutral-500" />
							</Button>

							<input
								ref={fileInputRef}
								type="file"
								accept={SUPPORTED_UPLOAD_ACCEPT}
								multiple
								className="hidden"
								onChange={handleFileChange}
							/>

							<button
								type="button"
								aria-label="Send message"
								className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400"
								disabled={!canSend}
								onClick={() => void handleSend()}
							>
								<ArrowUp className="h-4 w-4" />
							</button>
						</div>
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

				{warning && (
					<p className="mt-2 text-center text-xs text-red-500">{warning}</p>
				)}
			</div>
		</div>
	);
}
