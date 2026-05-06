import {
	ChevronLeft,
	ChevronRight,
	FileText,
	Files,
	Plus,
	Upload,
	X,
} from "lucide-react";
import {
	type DragEvent,
	type MouseEvent,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import { usePanelLayout } from "../hooks/use-panel-layout";
import { useWorkspaceTabs } from "../hooks/use-workspace-tabs";
import type { ConversationDocument } from "../types";
import { DocumentViewer } from "./DocumentViewer";
import { FileRow } from "./FileRow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface WorkspacePanelProps {
	conversationId: string | null;
	documents: ConversationDocument[];
	uploading: boolean;
	onUpload: (files: File[]) => Promise<unknown>;
	onRemove: (id: string) => Promise<void> | void;
}

export function WorkspacePanel({
	conversationId,
	documents,
	uploading,
	onUpload,
	onRemove,
}: WorkspacePanelProps) {
	const { width, collapsed, setWidth, toggleCollapsed, minWidth, maxWidth } =
		usePanelLayout();
	const docIds = useMemo(() => documents.map((d) => d.id), [documents]);
	const { openTabIds, activeTab, openDoc, closeDoc, setActiveTab, focusFiles } =
		useWorkspaceTabs(conversationId, docIds);
	const [dragging, setDragging] = useState(false);

	const handleResize = useCallback(
		(e: MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startWidth = width;
			setDragging(true);

			const onMove = (ev: globalThis.MouseEvent) => {
				const delta = startX - ev.clientX;
				setWidth(startWidth + delta);
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

	if (collapsed) {
		return (
			<div className="flex h-full w-10 flex-shrink-0 flex-col items-center gap-2 bg-white py-3">
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
							onClick={toggleCollapsed}
							aria-label="Expand workspace"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">Expand workspace</TooltipContent>
				</Tooltip>
				<Files className="h-4 w-4 text-neutral-300" />
				<span className="text-xs text-neutral-400">{documents.length}</span>
			</div>
		);
	}

	const docTabs = openTabIds
		.map((id) => documents.find((d) => d.id === id))
		.filter((d): d is ConversationDocument => d !== undefined);

	return (
		<div
			style={{ width, minWidth, maxWidth }}
			className="relative flex h-full flex-shrink-0 flex-col border-l border-neutral-200 bg-white"
		>
			<button
				type="button"
				aria-label="Resize workspace"
				className={`absolute top-0 left-0 z-10 h-full w-0.5 cursor-col-resize transition-colors hover:bg-neutral-300 ${
					dragging ? "bg-neutral-400" : ""
				}`}
				onMouseDown={handleResize}
			/>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="flex h-full min-h-0 flex-col"
			>
				<div className="flex items-center gap-1 border-b border-neutral-100 px-2 py-1.5">
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
									className="ml-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
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
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
								onClick={toggleCollapsed}
								aria-label="Collapse workspace"
							>
								<ChevronRight className="h-4 w-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="left">Collapse</TooltipContent>
					</Tooltip>
				</div>

				<TabsContent value="files" className="flex min-h-0 flex-1 flex-col">
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
}

function FilesTabBody({
	conversationId,
	documents,
	uploading,
	onUpload,
	onRemove,
	onOpen,
	activeTab,
}: FilesTabBodyProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [dragOver, setDragOver] = useState(false);

	const handleFiles = (fileList: FileList | null) => {
		if (!fileList) return;
		const files = Array.from(fileList).filter((f) =>
			f.name.toLowerCase().endsWith(".pdf"),
		);
		if (files.length > 0) onUpload(files);
	};

	const onDragOver = (e: DragEvent) => {
		e.preventDefault();
		setDragOver(true);
	};
	const onDragLeave = (e: DragEvent) => {
		e.preventDefault();
		setDragOver(false);
	};
	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		setDragOver(false);
		handleFiles(e.dataTransfer.files);
	};

	if (!conversationId) {
		return (
			<div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-400">
				Select or create a conversation to start uploading files.
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col">
			<div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
				<span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
					Files in this conversation
				</span>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
					disabled={uploading}
				>
					<Plus className="h-3 w-3" />
					Add
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf"
					multiple
					className="hidden"
					onChange={(e) => {
						handleFiles(e.target.files);
						if (fileInputRef.current) fileInputRef.current.value = "";
					}}
				/>
			</div>

			<div
				className="flex-1 overflow-y-auto [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-200 [&::-webkit-scrollbar]:w-1.5"
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
			>
				{documents.length === 0 ? (
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className={`m-3 flex w-[calc(100%-1.5rem)] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-12 text-center transition-colors ${
							dragOver
								? "border-neutral-400 bg-neutral-50"
								: "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
						}`}
					>
						<Upload className="h-7 w-7 text-neutral-400" />
						<p className="text-sm font-medium text-neutral-600">
							Drop PDFs here or click to upload
						</p>
						<p className="text-xs text-neutral-400">
							Files appear here automatically when attached in chat too
						</p>
					</button>
				) : (
					<div className={`p-2 ${dragOver ? "bg-neutral-50" : ""}`}>
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
