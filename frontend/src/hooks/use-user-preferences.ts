import { useCallback, useEffect, useState } from "react";

const NAME_KEY = "folio:user:name";
const ONBOARDED_KEY = "folio:onboarding:completed";

function loadName(): string | null {
	try {
		const raw = localStorage.getItem(NAME_KEY);
		return raw && raw.trim().length > 0 ? raw : null;
	} catch {
		return null;
	}
}

function loadOnboarded(): boolean {
	try {
		return localStorage.getItem(ONBOARDED_KEY) === "true";
	} catch {
		return false;
	}
}

export function useUserPreferences() {
	const [userName, setUserNameState] = useState<string | null>(() =>
		loadName(),
	);
	const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(
		() => loadOnboarded(),
	);

	useEffect(() => {
		try {
			if (userName && userName.trim().length > 0) {
				localStorage.setItem(NAME_KEY, userName);
			} else {
				localStorage.removeItem(NAME_KEY);
			}
		} catch {
			// ignore
		}
	}, [userName]);

	useEffect(() => {
		try {
			if (hasCompletedOnboarding) {
				localStorage.setItem(ONBOARDED_KEY, "true");
			} else {
				localStorage.removeItem(ONBOARDED_KEY);
			}
		} catch {
			// ignore
		}
	}, [hasCompletedOnboarding]);

	const setUserName = useCallback((name: string | null) => {
		const trimmed = name?.trim();
		setUserNameState(trimmed && trimmed.length > 0 ? trimmed : null);
	}, []);

	const completeOnboarding = useCallback(() => {
		setHasCompletedOnboarding(true);
	}, []);

	return {
		userName,
		setUserName,
		hasCompletedOnboarding,
		completeOnboarding,
	};
}
