import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import type { Citation, ConfidenceState, Message } from "../types";

export function useMessages(conversationId: string | null) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [streaming, setStreaming] = useState(false);
	const [streamingContent, setStreamingContent] = useState("");
	const [streamingSources, setStreamingSources] = useState<Citation[]>([]);
	const [streamingReasoning, setStreamingReasoning] = useState("");
	const abortRef = useRef<AbortController | null>(null);

	const refresh = useCallback(async () => {
		if (!conversationId) {
			setMessages([]);
			return;
		}
		try {
			setLoading(true);
			setError(null);
			const data = await api.fetchMessages(conversationId);
			setMessages(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load messages");
		} finally {
			setLoading(false);
		}
	}, [conversationId]);

	useEffect(() => {
		refresh();
		return () => {
			if (abortRef.current) {
				abortRef.current.abort();
			}
		};
	}, [refresh]);

	const send = useCallback(
		async (
			content: string,
			documentIds?: string[],
			overrideConversationId?: string,
		) => {
			// Allow callers to pass a freshly-resolved conversation id (e.g. when a
			// new chat was just created in the same tick) — closure-captured state
			// may still be null at this point.
			const cid = overrideConversationId ?? conversationId;
			if (!cid || streaming) return;

			const userMessage: Message = {
				id: `temp-${Date.now()}`,
				conversation_id: cid,
				role: "user",
				content,
				sources_cited: 0,
				document_ids: documentIds ?? null,
				created_at: new Date().toISOString(),
			};

			setMessages((prev) => [...prev, userMessage]);
			setStreaming(true);
			setStreamingContent("");
			setStreamingReasoning("");
			setError(null);

			try {
				const response = await api.sendMessage(cid, content, documentIds);

				if (!response.body) {
					throw new Error("No response body");
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let accumulated = "";
				let buffer = "";

				// Stash for the dedicated `citations` SSE event. Citations may
				// arrive before OR after the canonical `message` event depending
				// on server ordering — we apply them whichever way around. A
				// single shared ref is fine because there's only one in-flight
				// assistant turn per conversation at a time.
				const pendingCitationsRef: {
					sources: Citation[] | null;
					confidence: ConfidenceState | null;
					applied: boolean;
				} = { sources: null, confidence: null, applied: false };

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					// Keep the last potentially incomplete line in the buffer
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed || !trimmed.startsWith("data: ")) continue;

						const data = trimmed.slice(6);
						if (data === "[DONE]") continue;

						try {
							const parsed = JSON.parse(data) as {
								type?: string;
								content?: string;
								delta?: string;
								message?: Message;
								source?: Citation;
								sources?: Citation[];
								confidence?: ConfidenceState;
								message_id?: string;
							};

							if (parsed.type === "reasoning" && parsed.delta) {
								setStreamingReasoning(
									(prev) => prev + (parsed.delta as string),
								);
							} else if (parsed.type === "delta" && parsed.delta) {
								accumulated += parsed.delta;
								setStreamingContent(accumulated);
							} else if (parsed.type === "content" && parsed.content) {
								accumulated += parsed.content;
								setStreamingContent(accumulated);
							} else if (parsed.type === "message" && parsed.message) {
								// Canonical assistant message. If the dedicated
								// `citations` event arrived first, merge; otherwise
								// the message already carries fields server-side.
								const incoming = { ...parsed.message } as Message;
								if (pendingCitationsRef.sources != null) {
									incoming.sources = pendingCitationsRef.sources;
								}
								if (pendingCitationsRef.confidence != null) {
									incoming.confidence = pendingCitationsRef.confidence;
								}
								pendingCitationsRef.applied = true;
								setMessages((prev) => [...prev, incoming]);
								accumulated = "";
							} else if (parsed.type === "source_preview" && parsed.source) {
								setStreamingSources((prev) => [
									...prev,
									parsed.source as Citation,
								]);
							} else if (parsed.type === "citations") {
								const sources = parsed.sources ?? [];
								const confidence = parsed.confidence ?? "ungrounded";
								if (pendingCitationsRef.applied) {
									// `message` already swapped in — patch it by id.
									const targetId = parsed.message_id;
									setMessages((prev) =>
										prev.map((m) =>
											targetId && m.id === targetId
												? { ...m, sources, confidence }
												: m,
										),
									);
								} else {
									pendingCitationsRef.sources = sources;
									pendingCitationsRef.confidence = confidence;
								}
							} else if (parsed.content && !parsed.type) {
								// Fallback: plain content field
								accumulated += parsed.content;
								setStreamingContent(accumulated);
							}
						} catch {
							// Skip invalid JSON lines
						}
					}
				}

				// If we accumulated content but never got a final message,
				// create a synthetic assistant message
				if (accumulated) {
					const assistantMessage: Message = {
						id: `stream-${Date.now()}`,
						conversation_id: cid,
						role: "assistant",
						content: accumulated,
						sources_cited: 0,
						created_at: new Date().toISOString(),
					};
					setMessages((prev) => [...prev, assistantMessage]);
				}

				// Intentional: do NOT refetch from the server here. The canonical
				// `message` SSE event already carries the persisted Message; an
				// extra `fetchMessages` would force a second re-render of the
				// just-swapped bubble and violate K-117's "without flicker"
				// criterion.
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				setError(err instanceof Error ? err.message : "Failed to send message");
			} finally {
				setStreaming(false);
				setStreamingContent("");
				setStreamingSources([]);
				setStreamingReasoning("");
			}
		},
		[conversationId, streaming],
	);

	return {
		messages,
		loading,
		error,
		streaming,
		streamingContent,
		streamingSources,
		streamingReasoning,
		send,
		refresh,
	};
}
