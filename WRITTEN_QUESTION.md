# Part 1 – Written Question: Most Significant Professional Achievement

One of my most significant achievements is an AI native platform I led the design engineering on at the company I work at. I'm picking it because the build changed me as much as it changed the product. Last year, when Sonnet 3.7 came out, I'd stopped using Figma and moved into Cursor. I'd been a designer for five years but wasn't really a developer, and the new models were changing what you could ship in a day. I either had to learn how to build with them or get left behind. This project was where that bet got tested at scale, and I came out the other side different from how I went in.

## Problem and context

The platform helps businesses build their own communities. For a lot of businesses, a community is more impactful than a CRM, because customers stop being records and start being people who interact with each other and with the business at the same time. Building a real community is much harder than running a CRM, and most businesses don't have the operational capacity to do it well. The platform gives the people running these communities the tools they need, with AI handling most of the mundane work so the humans can focus on people instead of admin.

## Complexity and constraints

The timeline was tight and the platform was effectively two products under one roof. The admin side was a technical, data dense dashboard for the operators running the communities. The member side was a social product for the people inside those communities. The two needed completely different design thinking, but had to share one platform, one design system, and feel like one product to anyone moving between them. The constant context switching was its own challenge: going between an operator's technical workflow mindset and a member's social mindset multiple times a day, and holding both audiences' needs in my head at once. Doing both well at the same time was the hardest part of the build.

Every community on the platform was also its own white label tenant with custom branding, custom domains, and separate access controls. Each one was effectively a separate app the operator ran as their own, which meant deciding which features made it into the first version and scoping the platform carefully against what one operator and one community could realistically use.

## Approach

My approach was a tight, iterative loop with the team and the customer. Each feature started with the product owner on requirements and the launch customer on what they wanted. Before writing any code, I'd invest time in planning and scoping the feature properly: what it needed to do and how it fit into the wider experience. From there I'd build a prototype on a feature branch with mock data and the full interaction model, review it with the team and the customer, iterate until the direction was agreed, and ship. Then I'd start the next one.

A lot of what helped here was the design work I'd been doing for the five years before any of this was AI native. Every feature drew on that. How a surface should feel, where it sits in the user's flow, what to ship in a first version and what to cut were all calls I could make from years of doing the work. With no time for personas or a full validation cycle, that experience and the customer in close contact kept the build on track.

What kept the loop fast was the AI native workflow. The real speed came from learning what to give the model, not from getting it to write code faster. I worked in Cursor, switching models depending on the job: Sonnet as the main driver, Grok Code for cheap frontend iteration when the loop ran long, Gemini Flash for small copy fixes. I built skills, instruction files, and visual test plans into the workflow, and made the agent ask me questions before generating rather than trust one shot output. AI is confidently wrong on UI quality, so I never accepted single session "done" on anything that mattered.

## Impact

The launch customer was a charity for nature lovers, with a global community spread across the world. Over time, the platform brought 1,500+ members together from zero. I was at the physical festival where the community launched, and I watched people coming in and posting photos, videos, and stories of nature from wherever they were, engaging with each other's work in real time. The mission mattered to me personally. I love nature, and seeing the community I'd designed come together that way made the build more meaningful than anything I'd shipped before.

## Reflection

Two things I'd change if I tackled this again.

The first is the foundation. From day one I'd lean on what the open source ecosystem already gives you: shadcn/ui and Radix UI as the base for the design system, the Vercel AI SDK for the AI surfaces, and the custom NPM package on top only for the components that were genuinely ours. It would have given me a more reliable foundation from day one and saved a week of overhead I didn't need to spend.

The second is how the features were sequenced. The platform needed breadth quickly, so I built many features in parallel. That kept the launch on track, but no single feature got the depth of attention it would have deserved on its own. If I tackled this again, I would spend more time on each feature: scope it properly up front, make sure it worked end to end on its own, and then start the next one. This wouldn't cost much in build speed, but every feature would land at higher quality, and everything built on top would be stronger for it.
