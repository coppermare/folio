export interface Conversation {
	id: string;
	title: string;
	created_at: string;
	updated_at: string;
	document_count: number;
}

export interface Citation {
	document_id: string;
	label: string;
}

export interface Message {
	id: string;
	conversation_id: string;
	role: "user" | "assistant" | "system";
	content: string;
	sources_cited: number;
	sources?: Citation[] | null;
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
