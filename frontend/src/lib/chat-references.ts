// Lightweight pub/sub bridge so any component (e.g. FileRow) can request that
// the active ChatInput add a file reference chip. Avoids drilling a callback
// through WorkspacePanel.

type Listener = (ref: { id: string; filename: string }) => void;

const listeners = new Set<Listener>();

export function onAddFileReference(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function emitAddFileReference(ref: { id: string; filename: string }) {
	for (const l of listeners) l(ref);
}

export const FILE_REF_MIME = "application/x-folio-fileref";

export interface FileRefPayload {
	id: string;
	filename: string;
}

export function encodeFileRef(ref: FileRefPayload): string {
	return JSON.stringify(ref);
}

export function decodeFileRef(raw: string): FileRefPayload | null {
	try {
		const parsed = JSON.parse(raw) as Partial<FileRefPayload>;
		if (typeof parsed.id === "string" && typeof parsed.filename === "string") {
			return { id: parsed.id, filename: parsed.filename };
		}
	} catch {
		// fallthrough
	}
	return null;
}

// Pub/sub for opening a document in the workspace panel from anywhere
// (e.g. an inline file chip inside an AI response).
type OpenListener = (id: string) => void;
const openListeners = new Set<OpenListener>();

export function onOpenDocument(listener: OpenListener): () => void {
	openListeners.add(listener);
	return () => openListeners.delete(listener);
}

export function emitOpenDocument(id: string) {
	for (const l of openListeners) l(id);
}
