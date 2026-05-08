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

	useEffect(() => {
		const clampToViewport = () => {
			// 250px ≈ sidebar, 360px = min chat width
			const dynamicMax = window.innerWidth - 250 - 360;
			if (dynamicMax < MIN_WIDTH) {
				// Not enough room — collapse so the chat window stays usable
				setLayout((prev) =>
					prev.collapsed ? prev : { ...prev, collapsed: true },
				);
			} else {
				setLayout((prev) => ({
					...prev,
					width: Math.min(prev.width, dynamicMax),
				}));
			}
		};
		clampToViewport();
		window.addEventListener("resize", clampToViewport);
		return () => window.removeEventListener("resize", clampToViewport);
	}, []);

	const setWidth = useCallback((width: number) => {
		setLayout((prev) => ({ ...prev, width: clamp(width) }));
	}, []);

	const toggleCollapsed = useCallback(() => {
		setLayout((prev) => ({ ...prev, collapsed: !prev.collapsed }));
	}, []);

	const expandToReadableWidth = useCallback(() => {
		setLayout((prev) => {
			const dynamicMax =
				typeof window !== "undefined"
					? window.innerWidth - 250 - 360
					: DEFAULT_WIDTH;
			const target = Math.max(prev.width, DEFAULT_WIDTH);
			return {
				collapsed: false,
				width: clamp(Math.min(target, Math.max(dynamicMax, MIN_WIDTH))),
			};
		});
	}, []);

	return {
		width: layout.width,
		collapsed: layout.collapsed,
		setWidth,
		toggleCollapsed,
		expandToReadableWidth,
		minWidth: MIN_WIDTH,
		maxWidth: MAX_WIDTH,
	};
}
