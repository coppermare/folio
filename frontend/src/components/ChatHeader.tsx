import { Files, Menu, MoreHorizontal } from "lucide-react";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { Conversation } from "../types";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface ChatHeaderProps {
	conversation: Conversation;
	onRename: (id: string, title: string) => Promise<void>;
	onDelete: (id: string) => Promise<void> | void;
	isMobile?: boolean;
	documentsCount?: number;
	onOpenSidebar?: () => void;
	onOpenWorkspace?: () => void;
}

export function ChatHeader({
	conversation,
	onRename,
	onDelete,
	isMobile = false,
	documentsCount = 0,
	onOpenSidebar,
	onOpenWorkspace,
}: ChatHeaderProps) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(conversation.title);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!editing) setDraft(conversation.title);
	}, [conversation.title, editing]);

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	const commit = useCallback(() => {
		const trimmed = draft.trim();
		if (!trimmed || trimmed === conversation.title) {
			setDraft(conversation.title);
			setEditing(false);
			return;
		}
		void onRename(conversation.id, trimmed);
		setEditing(false);
	}, [draft, conversation.id, conversation.title, onRename]);

	const cancel = useCallback(() => {
		setDraft(conversation.title);
		setEditing(false);
	}, [conversation.title]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault();
				commit();
			} else if (e.key === "Escape") {
				e.preventDefault();
				cancel();
			}
		},
		[commit, cancel],
	);

	return (
		<div className="flex h-10 flex-shrink-0 items-center justify-between gap-2 bg-gradient-to-b from-white to-transparent px-3 md:px-6">
			{isMobile && (
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 flex-shrink-0 md:hidden"
					onClick={onOpenSidebar}
					aria-label="Open conversations"
				>
					<Menu className="h-4 w-4 text-neutral-600" />
				</Button>
			)}
			<div className="min-w-0 md:flex-1">
				{editing ? (
					<input
						ref={inputRef}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={commit}
						onKeyDown={handleKeyDown}
						className="w-full max-w-md rounded border border-neutral-200 bg-white px-2 py-1 text-sm font-semibold text-neutral-800 outline-none focus:border-neutral-400"
					/>
				) : (
					<h2 className="max-w-[140px] truncate text-sm font-semibold text-neutral-800 md:max-w-none">
						{conversation.title}
					</h2>
				)}
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 flex-shrink-0"
						aria-label="Conversation options"
					>
						<MoreHorizontal className="h-4 w-4 text-neutral-500" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => setEditing(true)}>
						Rename
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirmOpen(true)}
					>
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{isMobile && <div className="flex-1 md:hidden" />}

			{isMobile && (
				<Button
					variant="ghost"
					size="icon"
					className="relative h-8 w-8 flex-shrink-0 md:hidden"
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
			)}

			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete this conversation?</DialogTitle>
						<DialogDescription>
							This will permanently remove the conversation and all of its
							messages. This can't be undone.
						</DialogDescription>
					</DialogHeader>
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={() => setConfirmOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								setConfirmOpen(false);
								void onDelete(conversation.id);
							}}
						>
							Delete
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
