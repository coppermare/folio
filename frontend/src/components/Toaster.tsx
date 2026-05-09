import { useEffect, useState } from "react";

interface Toast {
	id: string;
	message: string;
}

let counter = 0;

export function emitToast(message: string): void {
	window.dispatchEvent(new CustomEvent("folio:toast", { detail: { message } }));
}

export function Toaster() {
	const [toasts, setToasts] = useState<Toast[]>([]);

	useEffect(() => {
		const handler = (e: Event) => {
			const { message } = (e as CustomEvent<{ message: string }>).detail;
			counter += 1;
			const id = `t-${Date.now()}-${counter}`;
			setToasts((prev) => [...prev, { id, message }]);
			window.setTimeout(() => {
				setToasts((prev) => prev.filter((t) => t.id !== id));
			}, 3000);
		};
		window.addEventListener("folio:toast", handler);
		return () => window.removeEventListener("folio:toast", handler);
	}, []);

	return (
		<div
			aria-live="polite"
			className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
		>
			{toasts.map((t) => (
				<div
					key={t.id}
					className="rounded-card bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg"
				>
					{t.message}
				</div>
			))}
		</div>
	);
}
