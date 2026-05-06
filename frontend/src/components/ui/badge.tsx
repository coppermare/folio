import { type VariantProps, cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
	"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
	{
		variants: {
			variant: {
				default:
					"border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
				outline: "border-neutral-200 bg-white text-neutral-700",
				secondary: "border-transparent bg-neutral-900 text-white",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

interface BadgeProps
	extends HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<span className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}
