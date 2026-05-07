import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "folio:workspace-layout";

const MIN_WIDTH = 240;
const MAX_WIDTH = 960;
const DEFAULT_WIDTH = 440;

interface Layout {
	width: number;
	collapsed: boolean;
}

function load(): Layout {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { width: DEFAULT_WIDTH, collapsed: true };
		const parsed = JSON.parse(raw) as Partial<Layout>;
		return {
			width: clamp(parsed.width ?? DEFAULT_WIDTH),
			collapsed: parsed.collapsed === true,
		};
	} catch {
		return { width: DEFAULT_WIDTH, collapsed: true };
	}
}

function clamp(width: number): number {
	if (Number.isNaN(width)) return DEFAULT_WIDTH;
	return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

export function usePanelLayout() {
	const [layout, setLayout] = useState<Layout>(() => load());

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
		} catch {
			// ignore
		}
	}, [layout]);

	const setWidth = useCallback((width: number) => {
		setLayout((prev) => ({ ...prev, width: clamp(width) }));
	}, []);

	const toggleCollapsed = useCallback(() => {
		setLayout((prev) => ({ ...prev, collapsed: !prev.collapsed }));
	}, []);

	return {
		width: layout.width,
		collapsed: layout.collapsed,
		setWidth,
		toggleCollapsed,
		minWidth: MIN_WIDTH,
		maxWidth: MAX_WIDTH,
	};
}
