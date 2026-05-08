interface ThinkingIndicatorProps {
	label?: string;
}

export function ThinkingIndicator({ label }: ThinkingIndicatorProps) {
	return (
		<div className="flex items-center gap-2.5 py-1">
			<output
				className="grid h-4 w-4 grid-cols-3 grid-rows-3 gap-px"
				aria-label="Thinking"
			>
				{Array.from({ length: 9 }).map((_, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static grid
						key={i}
						className="pulse-grid-cell rounded-[1px] bg-[#FF7A42]"
						style={{
							animationDelay: `${(i % 3) * 90 + Math.floor(i / 3) * 60}ms`,
						}}
					/>
				))}
			</output>
			<span className="thinking-shimmer text-sm font-medium">
				{label ?? "Thinking…"}
			</span>
		</div>
	);
}
