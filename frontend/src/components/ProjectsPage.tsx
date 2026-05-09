import { FolderOpen, Menu, MessageSquare, Upload } from "lucide-react";
import { Button } from "./ui/button";

interface ProjectsPageProps {
	isMobile?: boolean;
	onOpenSidebar?: () => void;
}

export function ProjectsPage({ isMobile, onOpenSidebar }: ProjectsPageProps) {
	return (
		<main className="flex h-full flex-1 flex-col overflow-y-auto bg-white">
			{isMobile && (
				<div className="flex h-10 flex-shrink-0 items-center gap-2 bg-gradient-to-b from-white to-transparent px-3 lg:hidden">
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 flex-shrink-0"
						onClick={onOpenSidebar}
						aria-label="Open conversations"
					>
						<Menu className="h-4 w-4 text-neutral-600" />
					</Button>
					<span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800">
						Folio
					</span>
				</div>
			)}
			<div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-12 md:py-16">
				<img
					src="/projects-teaser.png"
					alt="Projects feature preview"
					className="block w-full rounded-card border border-neutral-200"
				/>

				<h1 className="mt-10 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
					Projects
				</h1>

				<p className="mt-4 text-base leading-relaxed text-neutral-700">
					Projects will give every deal its own dedicated workspace in Folio.
					The lease, title commitment, survey, environmental report, and every
					related document will live together in one place, ready for as many
					conversations as your matter requires. From diligence through closing
					and beyond, the full file set stays with the deal, so each chat opens
					with the right context already in place.
				</p>

				<div className="mt-10 grid gap-4 sm:grid-cols-3">
					<FeatureCard
						icon={<FolderOpen className="h-6 w-6" />}
						title="One Project per deal"
						body="A dedicated space for each matter, named however you'd label the closing binder."
					/>
					<FeatureCard
						icon={<Upload className="h-6 w-6" />}
						title="Files stay with the deal"
						body="Your PSA, lease, title, survey, and environmental will live with the Project, not the chat."
					/>
					<FeatureCard
						icon={<MessageSquare className="h-6 w-6" />}
						title="Unlimited conversations"
						body="Open as many chats as a matter needs, each with the full file set in context."
					/>
				</div>
			</div>
		</main>
	);
}

interface FeatureCardProps {
	icon: React.ReactNode;
	title: string;
	body: string;
}

function FeatureCard({ icon, title, body }: FeatureCardProps) {
	return (
		<div className="rounded-card border border-neutral-200 bg-white p-5">
			<div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
				{icon}
			</div>
			<h3 className="mt-3 text-sm font-semibold text-neutral-900">{title}</h3>
			<p className="mt-1 text-sm leading-relaxed text-neutral-600">{body}</p>
		</div>
	);
}
