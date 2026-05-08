import type {
	Conversation,
	ConversationDetail,
	Document,
	Message,
} from "../types";

const BASE = "/api";

async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const text = await response.text().catch(() => "Unknown error");
		throw new Error(`API error ${response.status}: ${text}`);
	}
	return response.json() as Promise<T>;
}

export async function fetchConversations(): Promise<Conversation[]> {
	const res = await fetch(`${BASE}/conversations`);
	return handleResponse<Conversation[]>(res);
}

export async function createConversation(): Promise<Conversation> {
	const res = await fetch(`${BASE}/conversations`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({}),
	});
	const detail = await handleResponse<ConversationDetail>(res);
	return {
		id: detail.id,
		title: detail.title,
		created_at: detail.created_at,
		updated_at: detail.updated_at,
		document_count: detail.documents.length,
	};
}

export async function updateConversation(
	id: string,
	title: string,
): Promise<Conversation> {
	const res = await fetch(`${BASE}/conversations/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title }),
	});
	const detail = await handleResponse<ConversationDetail>(res);
	return {
		id: detail.id,
		title: detail.title,
		created_at: detail.created_at,
		updated_at: detail.updated_at,
		document_count: detail.documents.length,
	};
}

export async function deleteConversation(id: string): Promise<void> {
	const res = await fetch(`${BASE}/conversations/${id}`, {
		method: "DELETE",
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "Unknown error");
		throw new Error(`API error ${res.status}: ${text}`);
	}
}

export async function fetchConversation(
	id: string,
): Promise<ConversationDetail> {
	const res = await fetch(`${BASE}/conversations/${id}`);
	return handleResponse<ConversationDetail>(res);
}

export async function fetchMessages(
	conversationId: string,
): Promise<Message[]> {
	const res = await fetch(`${BASE}/conversations/${conversationId}/messages`);
	return handleResponse<Message[]>(res);
}

export async function sendMessage(
	conversationId: string,
	content: string,
	documentIds?: string[],
	userName?: string | null,
): Promise<Response> {
	const body: {
		content: string;
		document_ids?: string[];
		user_name?: string;
	} = { content };
	if (documentIds && documentIds.length > 0) {
		body.document_ids = documentIds;
	}
	if (userName && userName.trim().length > 0) {
		body.user_name = userName.trim();
	}
	const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "Unknown error");
		throw new Error(`API error ${res.status}: ${text}`);
	}
	return res;
}

export interface UploadResult {
	document: Document;
	duplicate: boolean;
}

export async function uploadDocument(
	conversationId: string,
	file: File,
): Promise<UploadResult> {
	const formData = new FormData();
	formData.append("file", file);
	const res = await fetch(`${BASE}/conversations/${conversationId}/documents`, {
		method: "POST",
		body: formData,
	});
	const document = await handleResponse<Document>(res);
	const duplicate = res.headers.get("x-duplicate-upload") === "true";
	return { document, duplicate };
}

export async function fetchDocuments(
	conversationId: string,
): Promise<Document[]> {
	const res = await fetch(`${BASE}/conversations/${conversationId}/documents`);
	return handleResponse<Document[]>(res);
}

export async function deleteDocument(documentId: string): Promise<void> {
	const res = await fetch(`${BASE}/documents/${documentId}`, {
		method: "DELETE",
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "Unknown error");
		throw new Error(`API error ${res.status}: ${text}`);
	}
}

export function getDocumentUrl(documentId: string): string {
	return `${BASE}/documents/${documentId}/content`;
}
