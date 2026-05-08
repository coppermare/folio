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
	/**
	 * Milliseconds since streaming started. Used to gate the initial "Thinking"
	 * step — for the first ~700ms we show "Thinking through your question"
	 * before transitioning to "Scanning…/Reading…". Without this, the indicator
	 * jumps straight to a document-specific step which feels jarring.
	 */
	elapsedMs?: number;
}

const THINKING_PHASE_MS = 1200;
const READING_PHASE_MS = 3500;
const LOCATING_PHASE_MS = 6000;

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
	elapsedMs = Number.POSITIVE_INFINITY,
}: BuildArgs): CotStep[] {
	const content = (finalContent ?? streamingContent ?? "").toLowerCase();
	const steps: CotStep[] = [];

	const inThinkingPhase =
		streaming && content.length === 0 && elapsedMs < THINKING_PHASE_MS;

	steps.push({
		id: "think",
		label: "Thinking through your question",
		status: inThinkingPhase ? "active" : "done",
	});

	if (documents.length === 0) {
		if (content.length > 0 || (!streaming && !inThinkingPhase)) {
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

	const preProse = !inThinkingPhase && content.length === 0 && streaming;
	const inReadingPhase = preProse && elapsedMs < READING_PHASE_MS;
	const inLocatingPhase =
		preProse && elapsedMs >= READING_PHASE_MS && elapsedMs < LOCATING_PHASE_MS;
	const inPreparingPhase = preProse && elapsedMs >= LOCATING_PHASE_MS;

	const firstDoc = documents[0];
	steps.push({
		id: "scan",
		label:
			documents.length === 1 && firstDoc
				? `Reading ${firstDoc.filename}`
				: `Reading ${documents.length} documents`,
		status: inReadingPhase ? "active" : "done",
	});

	if (preProse) {
		steps.push({
			id: "locate-pre",
			label: "Locating cited sections",
			status: inLocatingPhase ? "active" : "done",
		});
		steps.push({
			id: "prepare",
			label: "Preparing answer",
			status: inPreparingPhase ? "active" : "done",
		});
	}

	const firstCited = cited[0];
	if (cited.length > 0) {
		steps.push({
			id: "locate",
			label:
				cited.length === 1 && firstCited
					? `Reading ${firstCited.filename}`
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
		const step = steps[i];
		if (step?.status === "active") {
			if (activeFound) step.status = "done";
			else activeFound = true;
		}
	}
	return steps;
}
