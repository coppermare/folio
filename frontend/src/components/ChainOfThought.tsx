import * as Collapsible from "@radix-ui/react-collapsible";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Check, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { CotStep } from "../lib/cot-steps";

interface ChainOfThoughtProps {
	steps: CotStep[];
	streaming: boolean;
	startedAt?: number;
	endedAt?: number;
}

export function ChainOfThought({
	steps,
	streaming,
	startedAt,
	endedAt,
}: ChainOfThoughtProps) {
	const [open, setOpen] = useState(streaming);

	// Auto-collapse shortly after streaming ends.
	useEffect(() => {
		if (streaming) {
			setOpen(true);
			return;
		}
		const t = window.setTimeout(() => setOpen(false), 600);
		return () => window.clearTimeout(t);
	}, [streaming]);

	if (steps.length === 0) return null;

	const elapsedMs =
		startedAt && endedAt
			? endedAt - startedAt
			: startedAt
				? Date.now() - startedAt
				: 0;
	const elapsedSec = Math.max(1, Math.round(elapsedMs / 1000));

	const summary = streaming ? "Thinking…" : `Thought for ${elapsedSec}s`;

	return (
		<Collapsible.Root open={open} onOpenChange={setOpen} className="mb-2">
			<Collapsible.Trigger asChild>
				<button
					type="button"
					className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
				>
					{streaming ? (
						<Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
					) : (
						<Brain className="h-3 w-3 text-neutral-400" />
					)}
					<span>{summary}</span>
					<ChevronDown
						className={`h-3 w-3 text-neutral-400 transition-transform duration-200 ease-out ${
							open ? "rotate-180" : ""
						}`}
					/>
				</button>
			</Collapsible.Trigger>
			<Collapsible.Content asChild forceMount>
				<motion.div
					initial={false}
					animate={{
						height: open ? "auto" : 0,
						opacity: open ? 1 : 0,
					}}
					transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
					className="overflow-hidden"
				>
					<div className="mt-1 ml-1 border-l border-neutral-200 pl-3">
						<AnimatePresence initial={false}>
							{steps.map((step) => (
								<motion.div
									key={step.id}
									initial={{ opacity: 0, x: -4 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.18, ease: "easeOut" }}
									className="flex items-center gap-2 py-1 text-xs"
								>
									<StepIcon status={step.status} />
									<span
										className={
											step.status === "active"
												? "text-neutral-700"
												: step.status === "done"
													? "text-neutral-500"
													: "text-neutral-400"
										}
									>
										{step.label}
									</span>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</motion.div>
			</Collapsible.Content>
		</Collapsible.Root>
	);
}

function StepIcon({ status }: { status: CotStep["status"] }) {
	if (status === "done") {
		return <Check className="h-3 w-3 text-neutral-400" />;
	}
	if (status === "active") {
		return <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />;
	}
	return (
		<span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-neutral-300" />
	);
}
