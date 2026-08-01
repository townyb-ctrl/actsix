# ACTSIX — Product Guide

> Organize the Work. Serve the Word.

Consult this when writing user-facing copy, naming a feature, or doing UI/UX work. Skip it for backend-only changes.

## Why ACTSIX exists

ACTSIX reduces administrative friction so church leaders spend more time on shepherding, discipleship, worship, prayer, teaching, and pastoral care. Software is not the mission — people are. If a feature only benefits the software rather than the people using it, it probably shouldn't exist.

Good ministry software disappears. Users should think about their service, their volunteers, their people — not the interface.

## Product philosophy

- **Reduce friction, not features.** Fewer clicks, fewer decisions, less typing, less repetition. A polished feature beats five unfinished ones — prefer refining what exists over expanding scope.
- **Protect attention.** Every notification, dialog, setting, and animation must earn its place. Avoid noise.
- **Calm over busy.** Clarity, space, simplicity, restraint. Users should leave feeling organized, not exhausted.
- **Opinionated over configurable.** When choosing between more settings and smarter defaults, choose smarter defaults. Freedom is valuable; guidance is more valuable.
- **Never punish mistakes.** Make dangerous actions intentional and recovery easy. Support undo where practical. Never trap users.
- **Consistency over novelty.** If ACTSIX already solves a problem one way, reuse that pattern — layout, navigation, forms, language.
- **Craft target: Linear, Notion, Basecamp, Apple.** Not Salesforce, SAP, Jira, or generic admin templates. Calm confidence, not feature density.

## UX heuristics

- **One primary goal per screen**, one obvious primary action. Everything else visually steps back.
- **Reduce cognitive load.** Let the software decide what it can decide; don't ask a question a sensible default could answer.
- **Reduce typing.** Prefer search, autocomplete, defaults, templates, and selection over free text entry.
- **Progressive disclosure.** Show what's needed now; reveal advanced options only when asked for.
- **Never surprise the user.** Consistent, predictable actions build confidence.
- **The five-second test.** A first-time user should know what a screen is, what they can do, and what to do first — within five seconds. If not, simplify.
- **The Thursday-afternoon test.** Picture a worship pastor prepping music, an admin organizing volunteers, and a lead pastor finishing a sermon, all at once. The software should make that moment feel calmer, not more overwhelming.

### Required states for any UI feature

- **Empty state:** why it's empty, what to do next, one clear action.
- **Loading state:** skeletons, progress indicators, or optimistic updates — never a blank screen.
- **Error state:** what happened, why (in plain language), what the user can do next. No stack traces, no blame.
- **Success:** a quiet confirmation (`✓ Task completed`). No confetti, no loud animation.

## Design review checklist

Before presenting finished UI/UX work, check:

- **First impression** — does it feel premium, calm, trustworthy at a glance?
- **Hierarchy** — can the eye find the title, primary action, and important info without competing elements?
- **Whitespace** — reach for spacing before borders/dividers/shadows to fix crowding.
- **Color** — used to mean something (primary actions, active nav, danger states), not to decorate. If everything's colorful, nothing stands out.
- **Buttons** — labels describe the action (`Assign Volunteer`, not `Submit`); destructive actions are visually separated.
- **Forms** — grouped fields, clear labels, sensible defaults, only genuinely required fields.
- **Navigation** — always answers "where am I / where can I go / how do I get back."
- **Mobile** — reviewed on phone/tablet/desktop, not just shrunk from desktop. Comfortable touch targets.
- **Accessibility** — keyboard navigation, visible focus states, contrast, labels, no color-only signaling.
- **Consistency** — spacing, buttons, cards, typography, and language match the rest of ACTSIX.
- **The ministry test** — would this reduce stress and save time for someone actually prepping for Sunday?

## Voice and language

Write like a helpful ministry assistant — never like enterprise software. Short. Clear. Human.

| Avoid | Prefer |
|---|---|
| User / Users | Person / People |
| Resource, Asset, Personnel (for a person) | Volunteer or Person |
| Contact | Person |
| Client, Customer, Organization | Church |
| Tenant | Workspace |
| Department, Division | Ministry |
| Employee, Staff Directory | Person, People Directory |
| Ticket, Issue | Task |
| Workflow, Pipeline | Process |
| Queue | Inbox |
| Entity, Record | The actual thing — Person, Task, Meeting, etc. |
| Execute | Complete |
| Deploy (user-facing) | Publish |
| Configuration, Parameter | Settings |
| Exception, Fatal Error | Something went wrong |
| Authentication Failure | Sign-in failed |
| Authorization Failure | You don't have permission |

Examples:

- "Workflow executed successfully." → **"Service published."**
- "User authentication failed." → **"We couldn't sign you in. Please check your email and password."**
- "Entity not found." → **"We couldn't find that person."**
- "An unexpected exception occurred." → **"Something went wrong. Please try again."**

Before shipping any user-facing text, ask: would a pastor naturally say this? Would a volunteer understand it without explanation?

## Glossary

- **Person / People** — never Users, Resources, Contacts, Records. People are the center of ACTSIX.
- **Volunteer** — someone serving in ministry (Worship Team Member, Sound Operator, Youth Leader). Never "resource," "personnel," or "headcount."
- **Team** — a group of people serving together (Worship Team, Hospitality Team).
- **Ministry** — an area of church life (Youth, Worship, Missions, Prayer).
- **Service** — a church gathering (Sunday Morning Service). When talking about backend code, say "backend service" / "service class" explicitly to avoid ambiguity.
- **Service Plan** — everything needed for a gathering: songs, readings, sermon, announcements, volunteers, running order.
- **Meeting** — intentional planning/leadership/shepherding time (Staff Meeting, Worship Planning).
- **Project** — ministry work spanning multiple days (Church Camp, Christmas Production, Building Renovation). Contains tasks, meetings, people, deadlines.
- **Task** — one actionable piece of work, named with a verb ("Book Sound Equipment," not "Sound").
- **Inbox** — quick capture, not storage. Nothing should live there permanently.
- **Dashboard** — an action page ("what needs attention, what happens today"), not an analytics page.
- **Calendar** — ministry commitments: services, meetings, projects, important dates.
- **Assignment** — a person connected to a responsibility (Serving on Worship, Running Sound).
- **Schedule** — who's serving, where, when. Easy to scan and print.
- **Workspace** — represents a church. Everything belongs to a workspace.
- **Resource** (non-person) — physical/digital items: microphone, projector, room, sheet music. Never used for a person.

## Final check

Would a pastor naturally say this? Would a volunteer understand it without explanation? If it sounds like enterprise software, rewrite it.
