import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 767.98px)";

function subscribe(callback: () => void) {
	if (typeof window === "undefined") return () => {};
	const mql = window.matchMedia(MOBILE_QUERY);
	mql.addEventListener("change", callback);
	return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
	if (typeof window === "undefined") return false;
	return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot() {
	return false;
}

export function useIsMobile() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
