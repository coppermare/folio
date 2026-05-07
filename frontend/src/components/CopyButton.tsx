import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface CopyButtonProps {
	text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	return (
		<Button
			type="button"
			variant="ghost"
			size="iconSm"
			className="text-neutral-600 hover:text-neutral-900"
			aria-label={copied ? "Copied" : "Copy message"}
			title={copied ? "Copied" : "Copy message"}
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(text);
				} catch {
					try {
						const ta = document.createElement("textarea");
						ta.value = text;
						ta.style.position = "fixed";
						ta.style.opacity = "0";
						document.body.appendChild(ta);
						ta.select();
						document.execCommand("copy");
						document.body.removeChild(ta);
					} catch {
						// give up — still show feedback below
					}
				}
				setCopied(true);
				window.setTimeout(() => setCopied(false), 1500);
			}}
		>
			{copied ? (
				<Check className="h-3.5 w-3.5" />
			) : (
				<Copy className="h-3.5 w-3.5" />
			)}
		</Button>
	);
}
