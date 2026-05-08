import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getDocumentUrl } from "../lib/api";

interface DocxRendererProps {
	documentId: string;
}

const HORIZONTAL_PADDING = 32;

export function DocxRenderer({ documentId }: DocxRendererProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const scaleObserverRef = useRef<ResizeObserver | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setError(null);
		setLoading(true);

		// Scale the rendered pages to fit the available width.
		// docx-preview emits sections at the document's native page width
		// (e.g. 8.5in). We measure the natural width once, then keep recomputing
		// scale as the panel resizes — same UX as PdfRenderer.
		const applyResponsiveScale = () => {
			const scrollEl = scrollRef.current;
			const wrapperHost = containerRef.current;
			if (!scrollEl || !wrapperHost) return;
			const wrapper = wrapperHost.querySelector<HTMLElement>(".docx-wrapper");
			const firstSection =
				wrapperHost.querySelector<HTMLElement>("section.docx");
			if (!wrapper || !firstSection) return;

			const naturalWidth = firstSection.offsetWidth;
			if (naturalWidth === 0) return;

			wrapper.style.transformOrigin = "top center";

			const recompute = () => {
				const available = scrollEl.clientWidth - HORIZONTAL_PADDING * 2;
				if (available <= 0) return;
				const scale = Math.min(1, available / naturalWidth);
				wrapper.style.transform = `scale(${scale})`;
				// After scaling, the wrapper visually occupies less space — bottom-
				// margin compensation prevents a large empty gap under the content.
				const naturalHeight = wrapper.scrollHeight;
				wrapper.style.marginBottom = `${(scale - 1) * naturalHeight}px`;
			};

			recompute();
			scaleObserverRef.current?.disconnect();
			const ro = new ResizeObserver(recompute);
			ro.observe(scrollEl);
			scaleObserverRef.current = ro;
		};

		(async () => {
			try {
				const [{ renderAsync }, res] = await Promise.all([
					import("docx-preview"),
					fetch(getDocumentUrl(documentId)),
				]);
				if (!res.ok) throw new Error(`Failed to load (${res.status})`);
				const buffer = await res.arrayBuffer();
				if (cancelled || !containerRef.current) return;
				containerRef.current.innerHTML = "";
				await renderAsync(buffer, containerRef.current, undefined, {
					inWrapper: true,
					ignoreWidth: false,
					ignoreHeight: false,
					ignoreFonts: false,
					breakPages: true,
					experimental: false,
					useBase64URL: true,
				});
				if (!cancelled) {
					setLoading(false);
					applyResponsiveScale();
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load file");
					setLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
			scaleObserverRef.current?.disconnect();
			scaleObserverRef.current = null;
		};
	}, [documentId]);

	if (error) {
		return (
			<div className="flex h-full items-center justify-center bg-neutral-50 p-6 text-sm text-neutral-500">
				{error}
			</div>
		);
	}

	return (
		<div className="relative flex h-full min-h-0 flex-col bg-neutral-50">
			<div
				ref={scrollRef}
				className="flex-1 overflow-y-auto px-8 pb-4 pt-4 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-200 [&::-webkit-scrollbar]:w-1.5"
			>
				{loading && (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
					</div>
				)}
				<div
					ref={containerRef}
					className={[
						"docx-render",
						// Override docx-preview's library-injected styles:
						// transparent wrapper bg (we own background via the parent),
						// no padding on wrapper (we control via outer scroll padding),
						// shrink the gap between pages, drop the heavy library shadow.
						"[&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-0 [&_.docx-wrapper]:!gap-0",
						"[&_section.docx]:!shadow-none [&_section.docx]:!mb-2 [&_section.docx]:bg-white",
					].join(" ")}
				/>
			</div>
		</div>
	);
}
