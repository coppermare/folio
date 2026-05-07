import type { ConversationDocument } from "../types";

export interface CotStep {
	id: string;
	label: string;
	status: "pending" | "active" | "done";
}

interface BuildArgs {
	streaming: boolean;
	streamingContent: string;
	finalContent?: string;
	documents: ConversationDocument[];
}

/**
 * Heuristic Chain of Thought: derive steps client-side from what we know
 * (documents in context + content streamed so far). This is intentionally
 * lightweight — the model on Haiku doesn't expose real reasoning tokens, so
 * the goal is a transparent "what's happening" surface, not faked thought.
 */
export function buildCotSteps({
	streaming,
	streamingContent,
	finalContent,
	documents,
}: BuildArgs): CotStep[] {
	const content = (finalContent ?? streamingContent ?? "").toLowerCase();
	const steps: CotStep[] = [];

	if (documents.length === 0) {
		steps.push({
			id: "think",
			label: "Thinking through your question",
			status: streaming && content.length === 0 ? "active" : "done",
		});
		if (content.length > 0 || !streaming) {
			steps.push({
				id: "compose",
				label: "Composing answer",
				status: streaming ? "active" : "done",
			});
		}
		return steps;
	}

	const cited = documents.filter((d) =>
		content.includes(d.filename.toLowerCase()),
	);

	steps.push({
		id: "scan",
		label:
			documents.length === 1
				? `Scanning ${documents[0].filename}`
				: `Scanning ${documents.length} documents`,
		status: content.length === 0 && streaming ? "active" : "done",
	});

	if (cited.length > 0) {
		steps.push({
			id: "locate",
			label:
				cited.length === 1
					? `Reading ${cited[0].filename}`
					: `Cross-referencing ${cited.length} documents`,
			status: streaming ? "active" : "done",
		});
	}

	const hasSectionRef = /\b(section|clause|paragraph|page)\s+\d+/i.test(
		content,
	);
	if (hasSectionRef) {
		steps.push({
			id: "cite",
			label: "Locating cited sections",
			status: streaming ? "active" : "done",
		});
	}

	steps.push({
		id: "compose",
		label: "Drafting answer",
		status: streaming && content.length > 0 ? "active" : "done",
	});

	// Only one step should be "active" at a time — the latest one.
	let activeFound = false;
	for (let i = steps.length - 1; i >= 0; i--) {
		if (steps[i].status === "active") {
			if (activeFound) steps[i].status = "done";
			else activeFound = true;
		}
	}
	return steps;
}
