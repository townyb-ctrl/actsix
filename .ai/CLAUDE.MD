# ACTSIX — Engineering Guide

> Organize the Work. Serve the Word.

ACTSIX = ministry-operations platform for churches. Cut admin friction so leaders spend time on people, prayer, worship, discipleship, ministry of Word. Admin support ministry; never become focus.

## Reading priority

1. Explicit user instructions (this conversation)
2. This file
3. `PRODUCT_GUIDE.md` — read when writing user-facing copy, naming features, or doing UI/UX work. Skip for backend-only or infra tasks.

Conflict unresolvable? Stop, ask.

## How to work

- **Understand before building.** Inspect existing implementation, find existing patterns and reusable components/services, before writing code. No guessing — ask if unclear.
- **Reuse before creating.** Search project before adding component, hook, service, utility, type, or helper. Something close exists → extend it, not duplicate.
- **Stay scoped.** Change only what asked. Match existing formatting/naming in file you edit — no reformat of untouched code. Minimal diffs over full-file rewrites. No new files unless task calls for them. No refactor of adjacent code, no rename, no folder reorg, no dependency install unless that the ask.
- **Pause on scale.** Change touch more than 2–3 files, or big architectural change? Confirm approach first, not silently.
- **Leave it better.** Small in-scope improvements (naming, duplication, readability, accessibility) welcome as you touch code. Big speculative refactors not — flag instead.

### Ask first, don't just do it

- Installing new dependency
- Creating new top-level folder
- Introducing new state-management approach or architectural pattern
- Duplicating business logic or components
- Bypassing authentication or disabling Row Level Security
- Exposing secrets or hardcoding credentials
- Rewriting large sections of project
- Destructive git operations (force-push, reset --hard, etc. — see harness-level git safety rules, which take precedence)

## Verifying work

After change, run what relevant:

- `npm run build` — always, before task done. Resolve every build error.
- `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm test` — for any TypeScript/logic change.
- `npm run dev` plus manual browser check — for UI-visible changes, to confirm no console errors, no runtime exceptions, feature behave as expected. Not needed for backend-only, test-only, or config-only changes.

Never claim something work without verifying this way. Test more than happy path where cheap: empty states, invalid input, permission failures, missing data.

## Codebase reality (read before applying "Engineering Rules" below)

Rules below describe where ACTSIX architecture heading, not strict gate on every existing file:

- Current pattern = `src/features/<domain>/{pages,components,api,hooks,types}` plus legacy flat `src/pages/`, not formal named-service layer (`TaskService`, etc.). Write new backend logic easy to extract into service later, but no refactor of existing `api/*.ts` files to this shape unless that the actual task.
- `(supabase as any)` used pragmatically across codebase where generated Supabase types don't cover query shape. Don't strip opportunistically — touch a cast only when it actually block the task (e.g. strict-mode TypeScript work already done).
- No `project_specs.md` process. Judgment calls resolved by asking user direct (`AskUserQuestion`), not by writing spec doc first.

## Engineering rules

- **Layers.** Prefer: Page/Route → data access (hook or `api/*.ts`) → Supabase → back up to UI. Keep business logic out of presentation code.
- **Thin pages.** Pages fetch data, compose layout, render components. Page hard to follow? Extract logic into hook or `api/*.ts` function.
- **Focused components.** One UI problem per component. Search for existing one before creating new. Split "god components" (see: `EventManagement.tsx` before deletion, `TrainingCenter.tsx` now) into smaller pieces, not grow further.
- **Model ministry, not UI.** DB tables represent real concepts (People, Teams, Meetings, Projects, Services, Tasks), not interface state (`DashboardWidgets`, `PopupState`).
- **Name things clearly.** No `Helper`, `Utils`, `Manager`, `Thing`, `Data`, `Misc`. Names describe purpose: `VolunteerAssignmentService`, `TaskPriorityBadge`.
- **Readable TypeScript.** Explicit interfaces over clever types. Avoid new `any` in code you write (existing pragmatic casts fine, see above).
- **Keep state local.** Local state or context before new global store. No new state-management library without asking first.
- **Validate at boundaries.** User input, query/route params, API requests — validate on both client and server.
- **Fail gracefully.** Every failure path answer: what failed, can user recover, what happen next. Never expose stack traces or raw exceptions to user.
- **Log with intent.** Logs explain what started/completed/failed. Remove temporary debug logs before finishing.
- **Protect secrets.** Never commit API keys, tokens, service-role keys, or credentials. Env vars only. Assume all client code public.
- **Keep dependencies small.** Before adding one, ask if existing platform feature solve it, and if still worth maintaining in two years.

## Definition of done

- Requested functionality implemented; existing functionality still work
- Build, typecheck, lint, relevant tests pass
- No runtime errors or console warnings introduced
- Follows existing architecture, reuses existing components where reasonable
- Loading / empty / error states exist for new UI
- Accessibility and mobile responsiveness considered for new UI
- Security and performance considered
- One final self-review pass: could this be simpler, did I introduce debt, would another engineer approve it

## Living documentation

Mistake or guidance gap recur? Don't just fix code — consider whether `CLAUDE.md` or `PRODUCT_GUIDE.md` need update so it less likely to happen again.