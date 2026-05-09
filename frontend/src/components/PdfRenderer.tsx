import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Document as PDFDocument, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { getDocumentUrl } from "../lib/api";
import { consumePendingJump, onJumpToPage } from "../lib/chat-references";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

interface PdfRendererProps {
	documentId: string;
}

interface PageWrapperProps {
	pageNumber: number;
	width: number;
	onVisible: (pageNumber: number) => void;
	scrollRoot: HTMLDivElement | null;
}

function PageWrapper({
	pageNumber,
	width,
	onVisible,
	scrollRoot,
}: PageWrapperProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [shouldRender, setShouldRender] = useState(pageNumber === 1);
	const [isMostlyVisible, setIsMostlyVisible] = useState(false);

	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		const renderObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setShouldRender(true);
					}
				}
			},
			{ root: scrollRoot, rootMargin: "1200px 0px" },
		);
		renderObserver.observe(node);

		const visibilityObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					setIsMostlyVisible(entry.intersectionRatio > 0.5);
				}
			},
			{ root: scrollRoot, threshold: [0, 0.5, 1] },
		);
		visibilityObserver.observe(node);

		return () => {
			renderObserver.disconnect();
			visibilityObserver.disconnect();
		};
	}, [scrollRoot]);

	useEffect(() => {
		if (isMostlyVisible) onVisible(pageNumber);
	}, [isMostlyVisible, pageNumber, onVisible]);

	return (
		<div
			ref={ref}
			data-page={pageNumber}
			className="mx-auto flex flex-col items-center"
			style={{ minHeight: width * 1.3 }}
		>
			{shouldRender ? (
				<Page
					pageNumber={pageNumber}
					width={width}
					loading={
						<div
							className="flex items-center justify-center"
							style={{ height: width * 1.3 }}
						>
							<Loader2 className="h-5 w-5 animate-spin text-neutral-300" />
						</div>
					}
				/>
			) : (
				<div
					className="flex w-full items-center justify-center bg-neutral-50"
					style={{ height: width * 1.3 }}
				/>
			)}
			<p className="my-2 text-xs text-neutral-400">Page {pageNumber}</p>
		</div>
	);
}

export function PdfRenderer({ documentId }: PdfRendererProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
	const [numPages, setNumPages] = useState(0);
	const [pageWidth, setPageWidth] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);

	useEffect(() => {
		const node = containerRef.current;
		if (!node) return;
		setScrollEl(node);
		const observer = new ResizeObserver(() => {
			const padding = 32;
			setPageWidth(Math.max(200, node.clientWidth - padding));
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	const handleJump = (target: number) => {
		const node = containerRef.current;
		if (!node) return;
		const page = node.querySelector<HTMLDivElement>(`[data-page="${target}"]`);
		page?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	// Inline-citation page jumps. Two paths:
	// (1) Sticky buffer — citation fired emitJumpToPage *before* this doc was
	//     mounted; consume-and-clear once numPages is known so the page anchor
	//     exists. We also watch `pageWidth` because page anchors only render
	//     after the layout pass completes.
	// (2) Live subscription — citation fired while we're already mounted on
	//     the target doc.
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleJump only depends on containerRef, which is stable
	useEffect(() => {
		if (numPages === 0 || pageWidth === 0) return;
		const pending = consumePendingJump(documentId);
		if (pending != null) {
			handleJump(Math.min(Math.max(pending, 1), numPages));
		}
	}, [documentId, numPages, pageWidth]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: handleJump only depends on containerRef, which is stable
	useEffect(() => {
		const off = onJumpToPage((targetDocId, page) => {
			if (targetDocId !== documentId) return;
			if (numPages === 0) return; // sticky buffer will catch it on mount
			handleJump(Math.min(Math.max(page, 1), numPages));
		});
		return off;
	}, [documentId, numPages]);

	const url = getDocumentUrl(documentId);

	return (
		<div className="flex h-full min-h-0 flex-col bg-neutral-50">
			<div
				ref={containerRef}
				className="flex-1 overflow-y-auto px-4 pb-4 pt-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-200 [&::-webkit-scrollbar]:w-1.5"
			>
				{error && (
					<div className="rounded-control bg-red-50 p-3 text-sm text-red-600">
						{error}
					</div>
				)}
				{pageWidth > 0 && (
					<PDFDocument
						file={url}
						onLoadSuccess={({ numPages: pages }) => {
							setNumPages(pages);
							setError(null);
						}}
						onLoadError={(err) =>
							setError(`Failed to load PDF: ${err.message}`)
						}
						loading={
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
							</div>
						}
					>
						<div className="space-y-4">
							{Array.from({ length: numPages }, (_, i) => i + 1).map(
								(pageNumber) => (
									<PageWrapper
										key={pageNumber}
										pageNumber={pageNumber}
										width={pageWidth}
										onVisible={setCurrentPage}
										scrollRoot={scrollEl}
									/>
								),
							)}
						</div>
					</PDFDocument>
				)}
			</div>
			{numPages > 0 && (
				<div className="flex items-center justify-between border-t border-neutral-100 bg-white px-3 py-1.5 text-xs text-neutral-500">
					<span>
						Page {currentPage} of {numPages}
					</span>
					<div className="inline-flex items-center overflow-hidden rounded-control border border-neutral-200">
						<button
							type="button"
							aria-label="Next page"
							className="flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-40"
							disabled={currentPage >= numPages}
							onClick={() => handleJump(Math.min(numPages, currentPage + 1))}
						>
							<ArrowDown className="h-3.5 w-3.5" />
						</button>
						<div className="h-5 w-px bg-neutral-200" />
						<button
							type="button"
							aria-label="Previous page"
							className="flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-40"
							disabled={currentPage <= 1}
							onClick={() => handleJump(Math.max(1, currentPage - 1))}
						>
							<ArrowUp className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
