# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Church/ministry leaders (pastors, ministry leaders) and volunteer coordinators, both as direct users — planning, assigning, and tracking practical ministry work (tasks, meetings, projects, service planning, people/volunteer management). Individual volunteers are not confirmed as direct app users; they may receive assignments outside the app (text, printed schedule) rather than logging in themselves.

## Product Purpose

ACTSIX is a modular ministry-operations platform that reduces administrative friction so church leaders spend more time on people, prayer, worship, discipleship, and the ministry of the Word — administration supports ministry, never becomes the focus. First functional module is **ACTSIX: Tasks**, a ministry-focused, GTD-influenced capture/clarify/organize/complete workflow. Other modules (meetings, service planning, sermon prep, people care, ministry administration) are part of the long-term vision but are frozen while Tasks is polished — see Capabilities and Constraints.

## Positioning

Ministry-specific structure, not a generic productivity tool relabeled for churches. Models real ministry concepts (People, Teams, Meetings, Projects, Services, Tasks) rather than generic interface state. Craft target is Linear/Notion/Basecamp/Apple — calm confidence — explicitly not Salesforce/SAP/Jira/generic admin templates.

## Operating Context

The "Thursday-afternoon test" is the reference scene: a worship pastor prepping music, an admin organizing volunteers, and a lead pastor finishing a sermon, all at once, often on limited time and attention. The product must make that moment calmer, not more overwhelming. A workspace represents one church; everything belongs to a workspace.

## Capabilities and Constraints

- Current shipped surface (as of this writing): `dashboard`, `tasks`, `meetings`, `people`, `projects`, `reminders`, `service-planning`, `settings`, `workspace` under `src/features/`, plus a legacy flat `src/pages/`.
- **Tasks gets depth over breadth**: newer modules are intentionally frozen; Tasks is the module getting polished first. Don't propose expanding a frozen module's scope without confirming first.
- Stack: Vite + React + TypeScript, shadcn/ui (Radix primitives) + Tailwind, Supabase backend. (Existing codebase — not a greenfield stack decision.)
- Detailed engineering/architecture rules live in `.ai/CLAUDE.MD`; UX/voice rules live in `.ai/PRODUCT_GUIDE.md` — consult both for UI/UX work, this file does not duplicate them.
- Pre-launch: no live churches, customers, or usage data yet (see Evidence on Hand).

## Brand Commitments

- Name: **ACTSIX**. Tagline: "Organize the Work. Serve the Word." Named after Acts 6, where practical ministry needs were organized wisely so ministry of the Word and prayer could continue with focus.
- Voice: helpful ministry assistant, never enterprise-software tone — short, clear, human. Full glossary and do/don't vocabulary table (e.g. "Person" not "User", "Ministry" not "Department") is authoritative in `.ai/PRODUCT_GUIDE.md`; don't restate or diverge from it here.
- Visual/product principles already committed in README and PRODUCT_GUIDE (see Product Principles below) — treat as binding, not just inspiration.

## Evidence on Hand

None. Pre-launch — no real churches, customers, testimonials, or usage data exist yet. Future work must not fabricate any of these (no invented church names, quotes, screenshots of "real" data, or usage stats).

## Product Principles

- **Reduce friction, not features.** A polished feature beats five unfinished ones — prefer refining what exists over expanding scope.
- **Calm over busy.** Clarity, space, simplicity, restraint over density.
- **Opinionated over configurable.** Smarter defaults over more settings.
- **Never punish mistakes.** Dangerous actions intentional, recovery easy, undo where practical.
- **Consistency over novelty.** Reuse ACTSIX's existing patterns (layout, navigation, forms, language) before inventing new ones.

## Accessibility & Inclusion

No formal standard mandated. Hold to solid general practice throughout: keyboard navigation, visible focus states, sufficient contrast, proper labels, no color-only signaling — per the Design review checklist in `.ai/PRODUCT_GUIDE.md`.
