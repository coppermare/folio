import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

interface ThoughtsPanelProps {
	reasoning: string;
	streaming: boolean;
}

export function ThoughtsPanel({ reasoning, streaming }: ThoughtsPanelProps) {
	const [open, setOpen] = useState(true);

	useEffect(() => {
		if (!streaming && reasoning) setOpen(false);
	}, [streaming, reasoning]);

	if (!reasoning) return null;

	return (
		<motion.div
			initial={{ opacity: 0, y: -2 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.18 }}
			className="mb-3"
		>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center gap-1.5 py-1 text-left text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-800"
			>
				<span className={streaming ? "thinking-shimmer" : ""}>
					{streaming ? "Reasoning" : "Reasoning trace"}
				</span>
				<ChevronDown
					className={`h-3 w-3 text-neutral-400 transition-transform ${
						open ? "rotate-0" : "-rotate-90"
					}`}
				/>
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.18, ease: "easeOut" }}
						className="overflow-hidden"
					>
						<div className="mt-1.5 rounded-lg bg-neutral-100 px-3 py-2.5 text-xs leading-relaxed text-neutral-600 whitespace-pre-wrap">
							{reasoning}
							{streaming && (
								<span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-neutral-400 align-middle" />
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}
