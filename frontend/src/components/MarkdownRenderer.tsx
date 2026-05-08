import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getDocumentUrl } from "../lib/api";

interface MarkdownRendererProps {
	documentId: string;
}

export function MarkdownRenderer({ documentId }: MarkdownRendererProps) {
	const [content, setContent] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setContent(null);
		setError(null);
		fetch(getDocumentUrl(documentId))
			.then(async (res) => {
				if (!res.ok) throw new Error(`Failed to load (${res.status})`);
				return res.text();
			})
			.then((text) => {
				if (!cancelled) setContent(text);
			})
			.catch((err) => {
				if (!cancelled) setError(err.message ?? "Failed to load file");
			});
		return () => {
			cancelled = true;
		};
	}, [documentId]);

	if (error) {
		return (
			<div className="flex h-full items-center justify-center bg-white p-6 text-sm text-neutral-500">
				{error}
			</div>
		);
	}

	if (content === null) {
		return (
			<div className="flex h-full items-center justify-center bg-white p-6 text-sm text-neutral-400">
				Loading…
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto bg-white">
			<div className="mx-auto max-w-3xl px-6 py-8">
				<article
					className={[
						"text-sm leading-relaxed text-neutral-800",
						"[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
						"[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold",
						"[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold",
						"[&_p]:my-3",
						"[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
						"[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6",
						"[&_li]:my-1",
						"[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2",
						"[&_strong]:font-semibold",
						"[&_em]:italic",
						"[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-200 [&_blockquote]:pl-4 [&_blockquote]:text-neutral-600",
						"[&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono",
						"[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-neutral-900 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-neutral-100",
						"[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-neutral-100",
						"[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
						"[&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-100 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
						"[&_td]:border [&_td]:border-neutral-200 [&_td]:px-2 [&_td]:py-1",
						"[&_hr]:my-6 [&_hr]:border-neutral-200",
						"[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded",
					].join(" ")}
				>
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
				</article>
			</div>
		</div>
	);
}
