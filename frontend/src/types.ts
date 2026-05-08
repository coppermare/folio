export interface Conversation {
	id: string;
	title: string;
	created_at: string;
	updated_at: string;
	document_count: number;
}

export interface Citation {
	document_id: string;
	page?: number | null;
	label: string;
	snippet?: string | null;
}

export type ConfidenceState = "grounded" | "partial" | "ungrounded";

export interface Message {
	id: string;
	conversation_id: string;
	role: "user" | "assistant" | "system";
	content: string;
	sources_cited: number;
	sources?: Citation[] | null;
	// Optional: older browser tabs against a redeployed server (or legacy
	// messages predating grounded-answers) lack this — treat absent as
	// "grounded" so we don't render spurious red ribbons during a deploy.
	confidence?: ConfidenceState;
	reasoning?: string | null;
	document_ids?: string[] | null;
	created_at: string;
}

export interface Document {
	id: string;
	conversation_id: string;
	filename: string;
	page_count: number;
	uploaded_at: string;
	extraction_failed: boolean;
}

export interface ConversationDocument {
	id: string;
	filename: string;
	page_count: number;
	uploaded_at: string;
	extraction_failed?: boolean;
}

export interface ConversationDetail {
	id: string;
	title: string;
	created_at: string;
	updated_at: string;
	documents: ConversationDocument[];
}
