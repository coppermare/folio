import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface OnboardingModalProps {
	open: boolean;
	onComplete: (name: string | null) => void;
}

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
	const [step, setStep] = useState<0 | 1>(0);
	const [name, setName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (step === 1) inputRef.current?.focus();
	}, [step]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		onComplete(trimmed.length > 0 ? trimmed : null);
	};

	return (
		<DialogPrimitive.Root open={open}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<DialogPrimitive.Content
					className="fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col overflow-y-auto overscroll-contain rounded-card border border-neutral-200 bg-white shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
					onPointerDownOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => {
						e.preventDefault();
						onComplete(null);
					}}
				>
					<DialogPrimitive.Title className="sr-only">
						Welcome to Folio
					</DialogPrimitive.Title>
					<DialogPrimitive.Description className="sr-only">
						Quick introduction to Folio and an optional name for a personalized
						greeting.
					</DialogPrimitive.Description>

					<HeroImage step={step} />

					{step === 0 ? (
						<div>
							<div className="px-6 pb-3 pt-6 sm:px-8 sm:pt-7">
								<h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
									Welcome to Folio.
								</h2>
								<p className="mt-2 text-sm leading-relaxed text-neutral-600">
									Document Q&amp;A for commercial real estate lawyers. Upload
									leases, title reports, and environmental assessments — ask
									questions, get answers grounded in your files.
								</p>
							</div>
							<div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-6 pt-4 sm:px-8">
								<Pagination current={0} onSelect={(i) => setStep(i as 0 | 1)} />
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="ghost"
										onClick={() => onComplete(null)}
									>
										Skip
									</Button>
									<Button onClick={() => setStep(1)} size="default">
										Next
									</Button>
								</div>
							</div>
						</div>
					) : (
						<form onSubmit={handleSubmit}>
							<div className="px-6 pb-3 pt-6 sm:px-8 sm:pt-7">
								<h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
									What should we call you?
								</h2>
								<p className="mt-2 text-sm leading-relaxed text-neutral-600">
									Optional — we'll use your name to personalize the greeting.
								</p>
								<input
									ref={inputRef}
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Your name"
									className="mt-5 w-full rounded-control border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
									maxLength={60}
								/>
							</div>
							<div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-6 pt-4 sm:px-8">
								<Pagination current={1} onSelect={(i) => setStep(i as 0 | 1)} />
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="ghost"
										onClick={() => onComplete(null)}
									>
										Skip
									</Button>
									<Button type="submit">Get started</Button>
								</div>
							</div>
						</form>
					)}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

function HeroImage({ step }: { step: 0 | 1 }) {
	const src = step === 0 ? "/onboarding-hero-1.jpg" : "/onboarding-hero-2.jpg";
	return (
		<div
			className="aspect-[16/9] max-h-[40vh] w-full flex-shrink-0 bg-neutral-900 bg-cover bg-center"
			style={{ backgroundImage: `url('${src}')` }}
		/>
	);
}

function Pagination({
	current,
	onSelect,
}: {
	current: number;
	onSelect: (index: number) => void;
}) {
	return (
		<div className="-my-2 flex items-center">
			{[0, 1].map((i) => (
				<button
					key={i}
					type="button"
					aria-label={`Go to step ${i + 1}`}
					aria-current={current === i ? "step" : undefined}
					onClick={() => onSelect(i)}
					className="group flex h-9 w-6 items-center justify-center"
				>
					<span
						className={cn(
							"h-1.5 rounded-full transition-all group-hover:bg-neutral-500",
							current === i ? "w-4 bg-neutral-800" : "w-1.5 bg-neutral-300",
						)}
					/>
				</button>
			))}
		</div>
	);
}
