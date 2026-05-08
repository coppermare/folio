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
	// Clear stale jump intents queued for OTHER docs — clicking pill A then doc
	// chip B shouldn't strand A's pending jump for the next time A is opened.
	for (const key of Object.keys(pendingJumps)) {
		if (key !== id) delete pendingJumps[key];
	}
	for (const l of openListeners) l(id);
}

// --- Inline citation: jump-to-page within a document --- //
// PdfRenderer.handleJump is an internal closure, so we use a pub/sub channel
// (mirroring emitOpenDocument) plus a sticky last-value buffer keyed by
// documentId. The buffer covers the async gap when a citation triggers
// emitOpenDocument for a doc that hasn't mounted yet — PdfRenderer reads its
// pending entry on mount and consumes-and-clears it.

type JumpListener = (documentId: string, page: number) => void;
const jumpListeners = new Set<JumpListener>();
const pendingJumps: Record<string, number> = {};

export function onJumpToPage(listener: JumpListener): () => void {
	jumpListeners.add(listener);
	return () => jumpListeners.delete(listener);
}

export function emitJumpToPage(documentId: string, page: number) {
	pendingJumps[documentId] = page;
	for (const l of jumpListeners) l(documentId, page);
}

export function consumePendingJump(documentId: string): number | null {
	const page = pendingJumps[documentId];
	if (page === undefined) return null;
	delete pendingJumps[documentId];
	return page;
}
