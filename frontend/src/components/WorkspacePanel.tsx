import {
	FilePlus,
	FileText,
	Files,
	PanelLeftOpen,
	PanelRightOpen,
	Plus,
	Upload,
	X,
} from "lucide-react";
import {
	type DragEvent,
	type MouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { usePanelLayout } from "../hooks/use-panel-layout";
import { useWorkspaceTabs } from "../hooks/use-workspace-tabs";
import { onOpenDocument } from "../lib/chat-references";
import { SUPPORTED_UPLOAD_ACCEPT, isSupportedUploadFile } from "../lib/uploads";
import type { ConversationDocument } from "../types";
import { DocumentViewer } from "./DocumentViewer";
import { FileRow } from "./FileRow";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface WorkspacePanelProps {
	conversationId: string | null;
	documents: ConversationDocument[];
	uploading: boolean;
	onUpload: (files: File[]) => Promise<unknown>;
	onRemove: (id: string) => Promise<void> | void;
	isMobile?: boolean;
	mobileOpen?: boolean;
	onMobileClose?: () => void;
}

export function WorkspacePanel({
	conversationId,
	documents,
	uploading,
	onUpload,
	onRemove,
	isMobile = false,
	mobileOpen = false,
	onMobileClose,
}: WorkspacePanelProps) {
	const {
		width,
		collapsed,
		setWidth,
		toggleCollapsed,
		expandToReadableWidth,
		minWidth,
		maxWidth,
	} = usePanelLayout();
	const docIds = useMemo(() => documents.map((d) => d.id), [documents]);
	const { openTabIds, activeTab, openDoc, closeDoc, setActiveTab, focusFiles } =
		useWorkspaceTabs(conversationId, docIds);
	const [dragging, setDragging] = useState(false);
	const dragCounter = useRef(0);
	const [fileDragging, setFileDragging] = useState(false);

	const handlePanelDragEnter = useCallback((e: DragEvent) => {
		if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
		e.preventDefault();
		dragCounter.current += 1;
		setFileDragging(true);
	}, []);

	const handlePanelDragOver = useCallback((e: DragEvent) => {
		if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	}, []);

	const handlePanelDragLeave = useCallback((e: DragEvent) => {
		if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
		e.preventDefault();
		dragCounter.current = Math.max(0, dragCounter.current - 1);
		if (dragCounter.current === 0) setFileDragging(false);
	}, []);

	const handlePanelDrop = useCallback(
		(e: DragEvent) => {
			if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
			e.preventDefault();
			dragCounter.current = 0;
			setFileDragging(false);
			const files = Array.from(e.dataTransfer.files ?? []).filter((f) =>
				isSupportedUploadFile(f.name),
			);
			if (files.length === 0) return;
			setActiveTab("files");
			void onUpload(files);
		},
		[onUpload, setActiveTab],
	);

	// Listen for chip-driven open requests from anywhere in the app. Auto-
	// surface the workspace if it's currently collapsed/hidden — clicking a
	// citation pill or file chip while the panel is closed should open it AND
	// route to the right doc, not silently no-op.
	useEffect(() => {
		return onOpenDocument((id) => {
			if (!docIds.includes(id)) return;
			openDoc(id);
			if (isMobile) {
				window.dispatchEvent(new CustomEvent("folio:open-workspace"));
			} else if (collapsed) {
				expandToReadableWidth();
			}
		});
	}, [docIds, openDoc, isMobile, collapsed, expandToReadableWidth]);

	const handleResize = useCallback(
		(e: MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startWidth = width;
			setDragging(true);

			const onMove = (ev: globalThis.MouseEvent) => {
				const delta = startX - ev.clientX;
				const dynamicMax = window.innerWidth - 250 - 360; // sidebar - min chat
				setWidth(Math.min(startWidth + delta, dynamicMax));
			};
			const onUp = () => {
				setDragging(false);
				window.removeEventListener("mousemove", onMove);
				window.removeEventListener("mouseup", onUp);
			};
			window.addEventListener("mousemove", onMove);
			window.addEventListener("mouseup", onUp);
		},
		[width, setWidth],
	);

	if (collapsed && !isMobile) {
		return (
			<div className="flex h-full w-10 flex-shrink-0 flex-col bg-white">
				<div className="flex h-10 flex-shrink-0 items-center justify-center px-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="iconSm"
								className="text-neutral-500"
								onClick={expandToReadableWidth}
								aria-label="Expand workspace"
							>
								<PanelRightOpen className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="left">Expand workspace</TooltipContent>
					</Tooltip>
				</div>
				<div className="flex flex-col items-center gap-2 py-3">
					<Files className="h-4 w-4 text-neutral-300" />
					<span className="text-xs text-neutral-400">{documents.length}</span>
				</div>
			</div>
		);
	}

	const docTabs = openTabIds
		.map((id) => documents.find((d) => d.id === id))
		.filter((d): d is ConversationDocument => d !== undefined);

	const containerStyle = isMobile ? undefined : { width, minWidth, maxWidth };
	const containerClass = isMobile
		? `fixed inset-y-0 right-0 z-50 flex h-full w-[min(90vw,420px)] flex-col overflow-hidden border-l border-neutral-200 bg-white shadow-xl transform transition-transform duration-200 ${
				mobileOpen ? "translate-x-0" : "translate-x-full"
			}`
		: "relative flex h-full flex-shrink-0 flex-col overflow-hidden border-l border-neutral-200 bg-white";

	return (
		<>
			{isMobile && mobileOpen && (
				<button
					type="button"
					aria-label="Close workspace"
					className="fixed inset-0 z-40 bg-black/40 lg:hidden"
					onClick={onMobileClose}
				/>
			)}
			<div
				style={containerStyle}
				className={containerClass}
				onDragEnter={handlePanelDragEnter}
				onDragOver={handlePanelDragOver}
				onDragLeave={handlePanelDragLeave}
				onDrop={handlePanelDrop}
			>
				{fileDragging && (
					<div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-white/85">
						<Upload className="h-6 w-6 text-neutral-500" />
						<span className="text-sm font-medium text-neutral-700">
							Drop files to attach
						</span>
					</div>
				)}
				{!isMobile && (
					<button
						type="button"
						aria-label="Resize workspace"
						className={`absolute top-0 left-0 z-10 h-full w-0.5 cursor-col-resize transition-colors hover:bg-neutral-300 ${
							dragging ? "bg-neutral-400" : ""
						}`}
						onMouseDown={handleResize}
					/>
				)}

				{isMobile && (
					<div className="flex h-10 flex-shrink-0 items-center justify-end border-b border-neutral-100 px-2">
						<Button
							variant="ghost"
							size="iconSm"
							className="text-neutral-500"
							onClick={onMobileClose}
							aria-label="Close workspace"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				)}

				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex h-full min-h-0 flex-col"
				>
					<div className="flex h-10 flex-shrink-0 items-center gap-1 border-b border-neutral-100 px-2">
						<TabsList className="flex-1">
							<TabsTrigger value="files" className="gap-1.5">
								<Files className="h-3.5 w-3.5" />
								Files
								{documents.length > 0 && (
									<span className="ml-0.5 rounded-full bg-neutral-200 px-1.5 text-[10px] text-neutral-600">
										{documents.length}
									</span>
								)}
							</TabsTrigger>
							{docTabs.map((doc) => (
								<TabsTrigger
									key={doc.id}
									value={doc.id}
									className="max-w-[180px] gap-1 pr-1"
								>
									<FileText className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" />
									<span className="truncate">{doc.filename}</span>
									{/* biome-ignore lint/a11y/useSemanticElements: nested button inside TabsTrigger button is invalid HTML */}
									<span
										role="button"
										tabIndex={0}
										aria-label={`Close ${doc.filename}`}
										className="ml-0.5 inline-flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
										onPointerDown={(e) => {
											e.stopPropagation();
											e.preventDefault();
											closeDoc(doc.id);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												closeDoc(doc.id);
											}
										}}
									>
										<X className="h-3 w-3" />
									</span>
								</TabsTrigger>
							))}
						</TabsList>
						{!isMobile && (
							<div className="flex-shrink-0">
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="iconSm"
											className="text-neutral-500"
											onClick={toggleCollapsed}
											aria-label="Collapse workspace"
										>
											<PanelLeftOpen className="h-4 w-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="left">Collapse</TooltipContent>
								</Tooltip>
							</div>
						)}
					</div>

					<TabsContent
						value="files"
						className="data-[state=inactive]:hidden flex min-h-0 flex-1 flex-col"
					>
						<FilesTabBody
							conversationId={conversationId}
							documents={documents}
							uploading={uploading}
							onUpload={onUpload}
							onRemove={async (id) => {
								await onRemove(id);
								closeDoc(id);
							}}
							onOpen={openDoc}
							activeTab={activeTab}
							panelWidth={isMobile ? undefined : width}
							dragHovered={fileDragging}
						/>
					</TabsContent>

					{docTabs.map((doc) => (
						<TabsContent
							key={doc.id}
							value={doc.id}
							forceMount
							className="data-[state=inactive]:hidden flex min-h-0 flex-col overflow-hidden"
						>
							<DocumentViewer document={doc} />
						</TabsContent>
					))}
				</Tabs>

				{/* Hidden trigger for "back to files" via keyboard etc. */}
				<button
					type="button"
					className="hidden"
					onClick={focusFiles}
					aria-hidden="true"
					tabIndex={-1}
				/>
			</div>
		</>
	);
}

interface FilesTabBodyProps {
	conversationId: string | null;
	documents: ConversationDocument[];
	uploading: boolean;
	onUpload: (files: File[]) => Promise<unknown>;
	onRemove: (id: string) => Promise<void> | void;
	onOpen: (id: string) => void;
	activeTab: string;
	panelWidth?: number;
	dragHovered?: boolean;
}

function FilesTabBody({
	conversationId,
	documents,
	uploading,
	onUpload,
	onRemove,
	onOpen,
	activeTab,
	panelWidth,
	dragHovered = false,
}: FilesTabBodyProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFiles = (fileList: FileList | null) => {
		if (!fileList) return;
		const files = Array.from(fileList).filter((f) =>
			isSupportedUploadFile(f.name),
		);
		if (files.length > 0) onUpload(files);
	};

	const isNarrow = panelWidth !== undefined && panelWidth < 320;
	const dropCopy = isNarrow
		? "Drop or click to upload"
		: "Drop files here or click to upload";
	const headerCopy = conversationId ? "Files in this conversation" : "Files";

	return (
		<div className="flex flex-1 flex-col">
			<div className="flex items-center justify-between px-3 py-2">
				<span className="truncate text-xs font-medium text-neutral-500">
					{headerCopy}
				</span>
				<Button
					variant="ghost"
					size="iconSm"
					onClick={() => fileInputRef.current?.click()}
					className="text-neutral-400 hover:text-neutral-600"
					disabled={uploading}
					aria-label="Add file"
				>
					<Plus className="h-3.5 w-3.5" />
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept={SUPPORTED_UPLOAD_ACCEPT}
					multiple
					className="hidden"
					onChange={(e) => {
						handleFiles(e.target.files);
						if (fileInputRef.current) fileInputRef.current.value = "";
					}}
				/>
			</div>

			<div className="flex-1 overflow-y-auto [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-200 [&::-webkit-scrollbar]:w-1.5">
				{documents.length === 0 ? (
					dragHovered ? null : (
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="m-3 flex h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] flex-col items-center justify-center gap-2 rounded-card bg-neutral-50 px-3 text-center transition-colors hover:bg-neutral-100"
						>
							<FilePlus className="h-5 w-5 flex-shrink-0 text-neutral-400" />
							<p className="text-balance text-sm font-medium text-neutral-600">
								{dropCopy}
							</p>
						</button>
					)
				) : (
					<div className="p-2">
						{documents.map((doc) => (
							<FileRow
								key={doc.id}
								document={doc}
								isActive={activeTab === doc.id}
								onOpen={onOpen}
								onRemove={onRemove}
							/>
						))}
						{uploading && (
							<p className="mt-2 px-2 text-xs text-neutral-400">Uploading...</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
