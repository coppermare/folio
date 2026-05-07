import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { citedDocuments } from "../lib/file-chip-utils";
import type { ConversationDocument, Message } from "../types";
import { CopyButton } from "./CopyButton";
import { FileChip } from "./FileChip";
import { SmoothMarkdown } from "./SmoothMarkdown";
import { ThinkingIndicator } from "./ThinkingIndicator";

interface MessageBubbleProps {
	message: Message;
	documents: ConversationDocument[];
}

export function MessageBubble({ message, documents }: MessageBubbleProps) {
	if (message.role === "system") {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.2 }}
				className="flex justify-center py-2"
			>
				<p className="text-xs text-neutral-400">{message.content}</p>
			</motion.div>
		);
	}

	if (message.role === "user") {
		const attachedDocs =
			message.document_ids && message.document_ids.length > 0
				? message.document_ids
						.map((id) => documents.find((d) => d.id === id))
						.filter(Boolean)
				: [];

		return (
			<motion.div
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.18, ease: "easeOut" }}
				className="group flex items-end justify-end gap-1.5 py-1.5"
			>
				<div className="opacity-0 transition-opacity group-hover:opacity-100">
					<CopyButton text={message.content} />
				</div>
				<div className="flex max-w-[75%] flex-col items-end gap-1.5">
					{attachedDocs.length > 0 && (
						<div className="flex flex-col items-end gap-1">
							{attachedDocs.map((d) => (
								<span
									key={d!.id}
									className="inline-flex max-w-[220px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-600"
									title={d!.filename}
								>
									<FileText className="h-3 w-3 flex-shrink-0 text-neutral-400" />
									<span className="truncate">{d!.filename}</span>
								</span>
							))}
						</div>
					)}
					<div className="rounded-2xl rounded-br-md bg-neutral-100 px-4 py-2.5">
						<p className="whitespace-pre-wrap text-sm text-neutral-800">
							{message.content}
						</p>
					</div>
				</div>
			</motion.div>
		);
	}

	const cited = citedDocuments(message.content, documents);

	return (
		<motion.div
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.18, ease: "easeOut" }}
			className="py-2"
		>
			<div className="min-w-0">
				<SmoothMarkdown content={message.content} documents={documents} />
				{cited.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{cited.map((d) => (
							<FileChip
								key={d.id}
								id={d.id}
								filename={d.filename}
								variant="block"
							/>
						))}
					</div>
				)}
				<div className="mt-2 flex items-center gap-1">
					<CopyButton text={message.content} />
				</div>
			</div>
		</motion.div>
	);
}

interface StreamingBubbleProps {
	content: string;
	documents: ConversationDocument[];
}

export function StreamingBubble({ content, documents }: StreamingBubbleProps) {
	return (
		<div className="py-2">
			<div className="min-w-0">
				{content ? (
					<SmoothMarkdown content={content} documents={documents} streaming />
				) : (
					<ThinkingIndicator />
				)}
			</div>
		</div>
	);
}
