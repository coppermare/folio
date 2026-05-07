import { AnimatePresence, motion } from "framer-motion";
import {
	MoreHorizontal,
	PanelLeftClose,
	PanelLeftOpen,
	Pencil,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { relativeTime } from "../lib/utils";
import type { Conversation } from "../types";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface ChatSidebarProps {
	conversations: Conversation[];
	selectedId: string | null;
	loading: boolean;
	onSelect: (id: string) => void;
	onCreate: () => void;
	onRename: (id: string, title: string) => void;
	onDelete: (id: string) => void;
	isMobile?: boolean;
	mobileOpen?: boolean;
	onMobileClose?: () => void;
}

export function ChatSidebar({
	conversations,
	selectedId,
	loading,
	onSelect,
	onCreate,
	onRename,
	onDelete,
	isMobile = false,
	mobileOpen = false,
	onMobileClose,
}: ChatSidebarProps) {
	const [collapsed, setCollapsed] = useState(false);
	const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const renameInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (renamingId && renameInputRef.current) {
			renameInputRef.current.focus();
			renameInputRef.current.select();
		}
	}, [renamingId]);

	const startRename = (conversation: Conversation) => {
		setRenamingId(conversation.id);
		setRenameValue(conversation.title);
	};

	const commitRename = () => {
		if (!renamingId) return;
		const trimmed = renameValue.trim();
		const original = conversations.find((c) => c.id === renamingId);
		if (trimmed && original && trimmed !== original.title) {
			onRename(renamingId, trimmed);
		}
		setRenamingId(null);
		setRenameValue("");
	};

	const cancelRename = () => {
		setRenamingId(null);
		setRenameValue("");
	};

	if (collapsed && !isMobile) {
		return (
			<div className="flex h-full w-10 flex-shrink-0 flex-col bg-white">
				<div className="flex h-10 flex-shrink-0 items-center justify-center px-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="iconSm"
								className="group relative text-neutral-500"
								onClick={() => setCollapsed(false)}
								aria-label="Expand sidebar"
							>
								<img
									src="/symbol.svg"
									alt="Folio"
									className="h-6 w-6 transition-opacity group-hover:opacity-0"
								/>
								<PanelLeftOpen className="absolute h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">Expand sidebar</TooltipContent>
					</Tooltip>
				</div>
				<div className="flex flex-col items-center gap-2 px-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="iconSm"
								className="text-neutral-500"
								onClick={onCreate}
								aria-label="New chat"
							>
								<Plus className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">New chat</TooltipContent>
					</Tooltip>
				</div>
			</div>
		);
	}

	const containerClass = isMobile
		? `fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-neutral-200 bg-white shadow-xl transform transition-transform duration-200 ${
				mobileOpen ? "translate-x-0" : "-translate-x-full"
			}`
		: "flex h-full w-[250px] flex-shrink-0 flex-col border-r border-neutral-200 bg-white";

	return (
		<>
			{isMobile && mobileOpen && (
				<button
					type="button"
					aria-label="Close sidebar"
					className="fixed inset-0 z-40 bg-black/40 md:hidden"
					onClick={onMobileClose}
				/>
			)}
			<div className={containerClass}>
				<div className="flex h-10 flex-shrink-0 items-center justify-between px-3">
					<img src="/folio_logo.svg" alt="Folio" className="h-6" />
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="iconSm"
								className="text-neutral-500"
								onClick={() =>
									isMobile ? onMobileClose?.() : setCollapsed(true)
								}
								aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
							>
								{isMobile ? (
									<X className="h-4 w-4" />
								) : (
									<PanelLeftClose className="h-4 w-4" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">
							{isMobile ? "Close" : "Collapse sidebar"}
						</TooltipContent>
					</Tooltip>
				</div>

				<div className="px-2 pt-3">
					<Button
						variant="ghost"
						size="sm"
						className="w-full justify-start gap-2 px-2"
						onClick={onCreate}
					>
						<Plus className="h-4 w-4" />
						New Chat
					</Button>
				</div>

				<div className="px-3 pt-4 pb-1">
					<span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
						Chat history
					</span>
				</div>

				<ScrollArea className="flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
					<div className="px-2 pb-2">
						{loading && conversations.length === 0 && (
							<div className="space-y-2 p-2">
								{[1, 2, 3].map((i) => (
									<div key={i} className="animate-pulse space-y-1">
										<div className="h-4 w-3/4 rounded bg-neutral-100" />
										<div className="h-3 w-1/2 rounded bg-neutral-50" />
									</div>
								))}
							</div>
						)}

						{!loading && conversations.length === 0 && (
							<p className="px-2 py-8 text-center text-xs text-neutral-400">
								No conversations yet
							</p>
						)}

						<AnimatePresence initial={false}>
							{conversations.map((conversation) => {
								const isSelected = selectedId === conversation.id;
								const isMenuOpen = menuOpenId === conversation.id;
								const isRenaming = renamingId === conversation.id;
								return (
									<motion.div
										key={conversation.id}
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: "auto" }}
										exit={{ opacity: 0, height: 0 }}
										transition={{ duration: 0.15 }}
									>
										<div
											className={`group relative rounded-control transition-colors ${
												isSelected ? "bg-neutral-100" : "hover:bg-neutral-50"
											}`}
										>
											<button
												type="button"
												className="flex w-full items-center px-2 py-1.5 text-left"
												onClick={() => {
													if (!isRenaming) onSelect(conversation.id);
												}}
											>
												<div className="min-w-0 flex-1 overflow-hidden pr-7">
													{isRenaming ? (
														<input
															ref={renameInputRef}
															value={renameValue}
															onChange={(e) => setRenameValue(e.target.value)}
															onClick={(e) => e.stopPropagation()}
															onBlur={commitRename}
															onKeyDown={(e) => {
																if (e.key === "Enter") {
																	e.preventDefault();
																	commitRename();
																} else if (e.key === "Escape") {
																	e.preventDefault();
																	cancelRename();
																}
															}}
															className="w-full rounded-control border border-neutral-300 bg-white px-1 py-0.5 text-sm text-neutral-800 outline-none focus:border-neutral-400"
														/>
													) : (
														<p className="truncate text-sm font-medium text-neutral-800">
															{conversation.title}
														</p>
													)}
													<p className="mt-0.5 text-[11px] text-neutral-400">
														{relativeTime(conversation.updated_at)}
													</p>
												</div>
											</button>

											<div
												className={`absolute right-1 top-1.5 ${
													isMenuOpen
														? "opacity-100"
														: "opacity-0 group-hover:opacity-100"
												}`}
											>
												<DropdownMenu
													open={isMenuOpen}
													onOpenChange={(open) =>
														setMenuOpenId(open ? conversation.id : null)
													}
												>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="iconSm"
															className="text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
															onClick={(e) => e.stopPropagation()}
															aria-label="Conversation actions"
														>
															<MoreHorizontal className="h-3.5 w-3.5" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" sideOffset={4}>
														<DropdownMenuItem
															onSelect={(e) => {
																e.preventDefault();
																setMenuOpenId(null);
																startRename(conversation);
															}}
														>
															<Pencil className="mr-2 h-3.5 w-3.5" />
															Rename
														</DropdownMenuItem>
														<DropdownMenuItem
															variant="destructive"
															onSelect={(e) => {
																e.preventDefault();
																setMenuOpenId(null);
																onDelete(conversation.id);
															}}
														>
															<Trash2 className="mr-2 h-3.5 w-3.5" />
															Delete chat
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</div>
									</motion.div>
								);
							})}
						</AnimatePresence>
					</div>
				</ScrollArea>
			</div>
		</>
	);
}
