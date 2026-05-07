import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "folio:workspace-tabs:";

interface PersistedState {
	openTabIds: string[];
	activeTab: string;
}

function load(conversationId: string | null): PersistedState {
	if (!conversationId) return { openTabIds: [], activeTab: "files" };
	try {
		const raw = localStorage.getItem(STORAGE_PREFIX + conversationId);
		if (!raw) return { openTabIds: [], activeTab: "files" };
		const parsed = JSON.parse(raw) as PersistedState;
		return {
			openTabIds: Array.isArray(parsed.openTabIds) ? parsed.openTabIds : [],
			activeTab:
				typeof parsed.activeTab === "string" ? parsed.activeTab : "files",
		};
	} catch {
		return { openTabIds: [], activeTab: "files" };
	}
}

function save(conversationId: string | null, state: PersistedState) {
	if (!conversationId) return;
	try {
		localStorage.setItem(
			STORAGE_PREFIX + conversationId,
			JSON.stringify(state),
		);
	} catch {
		// ignore quota errors
	}
}

export function useWorkspaceTabs(
	conversationId: string | null,
	availableDocIds: string[],
) {
	const [state, setState] = useState<PersistedState>(() =>
		load(conversationId),
	);

	// Reload state when conversation changes.
	useEffect(() => {
		setState(load(conversationId));
	}, [conversationId]);

	// Drop tabs whose documents are no longer present. Compare by joined key so
	// we don't loop on every render with a freshly allocated array.
	const idsKey = availableDocIds.join(",");
	useEffect(() => {
		if (availableDocIds.length === 0) return;
		setState((prev) => {
			const filtered = prev.openTabIds.filter((id) =>
				availableDocIds.includes(id),
			);
			if (filtered.length === prev.openTabIds.length) return prev;
			const nextActive =
				prev.activeTab !== "files" && !filtered.includes(prev.activeTab)
					? "files"
					: prev.activeTab;
			return { openTabIds: filtered, activeTab: nextActive };
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [idsKey]);

	useEffect(() => {
		save(conversationId, state);
	}, [conversationId, state]);

	const openDoc = useCallback((docId: string) => {
		setState((prev) => {
			const openTabIds = prev.openTabIds.includes(docId)
				? prev.openTabIds
				: [...prev.openTabIds, docId];
			return { openTabIds, activeTab: docId };
		});
	}, []);

	const closeDoc = useCallback((docId: string) => {
		setState((prev) => {
			const openTabIds = prev.openTabIds.filter((id) => id !== docId);
			const activeTab =
				prev.activeTab === docId
					? (openTabIds[openTabIds.length - 1] ?? "files")
					: prev.activeTab;
			return { openTabIds, activeTab };
		});
	}, []);

	const setActiveTab = useCallback((tab: string) => {
		setState((prev) => ({ ...prev, activeTab: tab }));
	}, []);

	const focusFiles = useCallback(() => setActiveTab("files"), [setActiveTab]);

	return {
		openTabIds: state.openTabIds,
		activeTab: state.activeTab,
		openDoc,
		closeDoc,
		setActiveTab,
		focusFiles,
	};
}
