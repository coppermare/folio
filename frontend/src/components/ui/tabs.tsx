import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import { cn } from "../../lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List
		ref={ref}
		className={cn(
			"no-scrollbar inline-flex items-center gap-0.5 overflow-x-auto",
			className,
		)}
		{...props}
	/>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = forwardRef<
	HTMLButtonElement,
	ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			"group/tab inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-control px-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-neutral-100 data-[state=active]:text-neutral-900",
			className,
		)}
		{...props}
	/>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content
		ref={ref}
		className={cn(
			"flex-1 outline-none focus-visible:ring-1 focus-visible:ring-neutral-400",
			className,
		)}
		{...props}
	/>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
