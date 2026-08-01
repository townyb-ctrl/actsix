# ACTSIX — Engineering Guide

> Organize the Work. Serve the Word.

ACTSIX is a ministry-operations platform for churches. Reduce administrative friction so leaders spend more time on people, prayer, worship, discipleship, and the ministry of the Word. Administration supports ministry; it never becomes the focus.

## Reading priority

1. Explicit user instructions (this conversation)
2. This file
3. `PRODUCT_GUIDE.md` — consult when writing user-facing copy, naming features, or doing UI/UX work. Skip it for backend-only or infra tasks.

If a conflict can't be resolved confidently, stop and ask.

## How to work

- **Understand before building.** Inspect the existing implementation, identify existing patterns and reusable components/services, before writing code. Don't guess — ask if something's unclear.
- **Reuse before creating.** Search the project before adding a component, hook, service, utility, type, or helper. If something close already exists, extend it rather than duplicating it.
- **Stay scoped.** Change only what was asked. Match the existing formatting/naming in the file you're editing — don't reformat untouched code. Prefer minimal diffs over full-file rewrites. Don't create new files unless the task calls for them. Don't refactor adjacent code, rename things, reorganize folders, or install dependencies unless that's the ask.
- **Pause on scale.** If a change would touch more than 2–3 files, or is a large architectural change, confirm the approach before proceeding rather than doing it silently.
- **Leave it better.** Small, in-scope improvements (naming, duplication, readability, accessibility) are encouraged as you touch code. Large speculative refactors are not — flag them instead of doing them.

### Ask first, don't just do it

- Installing a new dependency
- Creating a new top-level folder
- Introducing a new state-management approach or architectural pattern
- Duplicating business logic or components
- Bypassing authentication or disabling Row Level Security
- Exposing secrets or hardcoding credentials
- Rewriting large sections of the project
- Destructive git operations (force-push, reset --hard, etc. — see the harness-level git safety rules, which take precedence)

## Verifying work

After a change, run what's relevant to it:

- `npm run build` — always, before considering a task done. Resolve every build error.
- `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm test` — for any TypeScript/logic change.
- `npm run dev` and a manual check in the browser — for UI-visible changes, to confirm no console errors, no runtime exceptions, and the feature behaves as expected. Not needed for backend-only, test-only, or config-only changes.

Never claim something works without having verified it this way. Test more than the happy path where it's cheap to: empty states, invalid input, permission failures, missing data.

## Codebase reality (read before applying "Engineering Rules" below)

The rules below describe where ACTSIX's architecture is heading, not a strict gate on every existing file:

- The current pattern is `src/features/<domain>/{pages,components,api,hooks,types}` plus a legacy flat `src/pages/`, not a formal named-service layer (`TaskService`, etc.). Write new backend logic in a way that's easy to extract into a service later, but don't refactor existing `api/*.ts` files to match this shape unless that's the actual task.
- `(supabase as any)` is used pragmatically throughout the codebase where generated Supabase types don't cover a query shape. Don't strip these out opportunistically — only touch a cast when it's actually in the way of the task at hand (e.g. the strict-mode TypeScript work already done).
- There's no `project_specs.md` process. Judgment calls get resolved by asking the user directly (`AskUserQuestion`) rather than writing a spec doc first.

## Engineering rules

- **Layers.** Prefer: Page/Route → data access (hook or `api/*.ts`) → Supabase → back up to UI. Keep business logic out of presentation code.
- **Thin pages.** Pages fetch data, compose layout, render components. If a page gets hard to follow, extract logic into a hook or `api/*.ts` function.
- **Focused components.** One UI problem per component. Search for an existing one before creating a new one. Split "god components" (see: `EventManagement.tsx` before it was deleted, `TrainingCenter.tsx` now) into smaller pieces rather than growing them further.
- **Model ministry, not UI.** Database tables represent real concepts (People, Teams, Meetings, Projects, Services, Tasks), not interface state (`DashboardWidgets`, `PopupState`).
- **Name things clearly.** No `Helper`, `Utils`, `Manager`, `Thing`, `Data`, `Misc`. Prefer names that describe purpose: `VolunteerAssignmentService`, `TaskPriorityBadge`.
- **Readable TypeScript.** Prefer explicit interfaces over clever types. Avoid new `any` in code you're writing (existing pragmatic casts are fine, see above).
- **Keep state local.** Local state or context before reaching for a new global store. No new state-management library without asking first.
- **Validate at boundaries.** User input, query/route params, API requests — validate on both client and server.
- **Fail gracefully.** Every failure path should answer: what failed, can the user recover, what happens next. Never expose stack traces or raw exceptions to the user.
- **Log with intent.** Logs should explain what started/completed/failed. Remove temporary debug logs before finishing.
- **Protect secrets.** Never commit API keys, tokens, service-role keys, or credentials. Env vars only. Assume all client code is public.
- **Keep dependencies small.** Before adding one, ask whether an existing platform feature solves it, and whether it'll still be worth maintaining in two years.

## Definition of done

- Requested functionality implemented; existing functionality still works
- Build, typecheck, lint, and relevant tests pass
- No runtime errors or console warnings introduced
- Follows existing architecture and reuses existing components where reasonable
- Loading / empty / error states exist for new UI
- Accessibility and mobile responsiveness considered for new UI
- Security and performance considered
- One final self-review pass: could this be simpler, did I introduce debt, would another engineer approve it

## Living documentation

When a mistake or gap in guidance recurs, don't just fix the code — consider whether `CLAUDE.md` or `PRODUCT_GUIDE.md` should be updated so it's less likely to happen again.
