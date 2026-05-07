import { useMemo } from "react";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { defaultUrlTransform, Streamdown } from "streamdown";
import type { Pluggable } from "unified";
import "streamdown/styles.css";
import {
	FOLIO_CITE_PREFIX,
	FOLIO_DOC_PREFIX,
	injectFileChipLinks,
	injectInlineCitations,
	listifyAlphaEnumeration,
} from "../lib/file-chip-utils";
import type { Citation, ConversationDocument } from "../types";
import { FileChip } from "./FileChip";
import { InlineCitation } from "./InlineCitation";

// Streamdown's default rehype-sanitize strips href values whose protocol isn't
// in the allow-list, then rehype-harden replaces the link with a "[blocked]"
// span. Our internal `folio-doc://` and `folio-cite://` schemes are intentional
// handoffs to the anchor-component override — extend the sanitize schema so
// they survive, and replace the default rehypePlugins to use this schema. We
// deliberately drop rehype-harden because (a) `defaultUrlTransform` already
// guards against javascript: / data: from external content, and (b) harden
// "[blocked]"-wraps anything it doesn't recognise even when the upstream URL
// is safe.
const folioSanitizeSchema = {
	...defaultSchema,
	protocols: {
		...defaultSchema.protocols,
		href: [
			...(defaultSchema.protocols?.href ?? []),
			"folio-doc",
			"folio-cite",
		],
	},
};

const folioRehypePlugins: Pluggable[] = [
	rehypeRaw,
	[rehypeSanitize, folioSanitizeSchema],
];

const urlTransform = (
	url: string,
	key: string,
	node: Parameters<typeof defaultUrlTransform>[2],
): string | null | undefined => {
	if (url.startsWith(FOLIO_DOC_PREFIX) || url.startsWith(FOLIO_CITE_PREFIX)) {
		return url;
	}
	return defaultUrlTransform(url, key, node);
};

interface SmoothMarkdownProps {
	content: string;
	documents: ConversationDocument[];
	sources?: Citation[] | null;
	streaming?: boolean;
}

// Element-level styling using Tailwind utilities. Streamdown merges our
// `className` with its defaults via tailwind-merge, so conflicting utilities
// (font-size, margins, etc.) are deduped cleanly.
function buildComponents(
	sources: Citation[] | null | undefined,
	documents: ConversationDocument[],
) {
	return {
		h1: ({ children }: { children?: React.ReactNode }) => (
			<h1 className="text-base font-semibold text-neutral-900">{children}</h1>
		),
		h2: ({ children }: { children?: React.ReactNode }) => (
			<h2 className="text-[15px] font-semibold text-neutral-900">{children}</h2>
		),
		h3: ({ children }: { children?: React.ReactNode }) => (
			<h3 className="text-sm font-semibold text-neutral-900">{children}</h3>
		),
		h4: ({ children }: { children?: React.ReactNode }) => (
			<h4 className="text-sm font-semibold text-neutral-700">{children}</h4>
		),
		p: ({ children }: { children?: React.ReactNode }) => (
			<p className="leading-relaxed">{children}</p>
		),
		strong: ({ children }: { children?: React.ReactNode }) => (
			<strong className="font-semibold text-neutral-900">{children}</strong>
		),
		em: ({ children }: { children?: React.ReactNode }) => (
			<em className="italic">{children}</em>
		),
		ul: ({ children }: { children?: React.ReactNode }) => (
			<ul className="list-outside list-disc space-y-1 pl-5 marker:text-neutral-400">
				{children}
			</ul>
		),
		ol: ({ children }: { children?: React.ReactNode }) => (
			<ol className="list-outside list-decimal space-y-1 pl-5 marker:text-neutral-500">
				{children}
			</ol>
		),
		li: ({ children }: { children?: React.ReactNode }) => (
			<li className="pl-1 leading-relaxed [&>p]:inline">{children}</li>
		),
		blockquote: ({ children }: { children?: React.ReactNode }) => (
			<blockquote className="border-l-2 border-neutral-200 pl-3 text-neutral-600">
				{children}
			</blockquote>
		),
		hr: () => <hr className="border-neutral-200" />,
		code: ({ children, ...rest }: { children?: React.ReactNode }) => (
			<code
				className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] text-neutral-800"
				{...rest}
			>
				{children}
			</code>
		),
		pre: ({ children }: { children?: React.ReactNode }) => (
			<pre className="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">
				{children}
			</pre>
		),
		a: ({
			href,
			children,
			...rest
		}: {
			href?: string;
			children?: React.ReactNode;
		}) => {
			if (typeof href === "string" && href.startsWith(FOLIO_DOC_PREFIX)) {
				const id = href.slice(FOLIO_DOC_PREFIX.length);
				const filename =
					typeof children === "string"
						? children
						: Array.isArray(children)
							? children.join("")
							: String(children ?? "");
				return <FileChip id={id} filename={filename} variant="inline" />;
			}
			if (
				typeof href === "string" &&
				href.startsWith(FOLIO_CITE_PREFIX) &&
				sources
			) {
				const idxStr = href.slice(FOLIO_CITE_PREFIX.length).split("/")[0];
				const n = Number(idxStr);
				const citation = sources[n];
				if (Number.isInteger(n) && n >= 0 && citation !== undefined) {
					const filename =
						documents.find((d) => d.id === citation.document_id)?.filename ??
						null;
					return (
						<InlineCitation citation={citation} filename={filename} />
					);
				}
			}
			return (
				<a
					href={href}
					target="_blank"
					rel="noreferrer noopener"
					className="text-neutral-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500"
					{...rest}
				>
					{children}
				</a>
			);
		},
	};
}

// Tighten the outer wrapper's vertical rhythm.
// - `space-y-3` (12px) replaces Streamdown's default `space-y-4` (16px) via twMerge.
// - Heading→body gaps are explicitly tightened with the `!` modifier so they
//   beat the parent's `space-y-3 > * + *` selector specificity. This is the
//   standard Tailwind escape hatch for parent-child selector conflicts.
const WRAPPER_CLASS = [
	"space-y-3",
	"text-[0.9375rem]",
	"leading-relaxed",
	"text-neutral-800",
	"[&>h1+*]:!mt-1",
	"[&>h2+*]:!mt-1",
	"[&>h3+*]:!mt-1",
	"[&>h4+*]:!mt-1",
	"[&>*+h1]:!mt-4",
	"[&>*+h2]:!mt-4",
	"[&>*+h3]:!mt-3",
	"[&>*+h4]:!mt-3",
].join(" ");

export function SmoothMarkdown({
	content,
	documents,
	sources,
	streaming,
}: SmoothMarkdownProps) {
	const processed = useMemo(() => {
		// Order matters:
		// 1. Listify alphabetical enumerations BEFORE marker injection so the
		//    bullet split happens on raw prose (citations may sit inside items).
		// 2. Citation markers next, before file-chip mention substitution, so
		//    the file-chip pass doesn't accidentally consume citation link text.
		const listified = listifyAlphaEnumeration(content);
		const withCitations = injectInlineCitations(listified, sources);
		return injectFileChipLinks(withCitations, documents);
	}, [content, documents, sources]);

	const components = useMemo(
		() => buildComponents(sources, documents),
		[sources, documents],
	);

	return (
		<div className={streaming ? "smooth-md smooth-md--streaming" : "smooth-md"}>
			<Streamdown
				mode={streaming ? "streaming" : undefined}
				components={components}
				urlTransform={urlTransform}
				rehypePlugins={folioRehypePlugins}
				linkSafety={{ enabled: false }}
				className={WRAPPER_CLASS}
			>
				{processed}
			</Streamdown>
		</div>
	);
}
