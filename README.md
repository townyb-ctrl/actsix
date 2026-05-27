# ACTSIX

**Organize the work. Serve the Word.**

ACTSIX is a modular ministry operations platform built to help churches and ministry leaders manage practical ministry work with clarity, focus, and stewardship.

The first module, **ACTSIX: Tasks**, provides a focused workflow for capturing, clarifying, organizing, and completing ministry work. Over time, ACTSIX is designed to grow into a broader family of tools for meetings, service planning, sermon preparation, Scripture workflows, media, people care, and ministry administration.

---

## Vision

Church teams often carry complex ministry responsibilities across scattered tools, informal conversations, spreadsheets, notes, and memory.

ACTSIX exists to bring those responsibilities into a calm, structured workspace designed specifically for ministry.

The name and philosophy are inspired by Acts 6, where practical ministry needs were organized wisely so that the ministry of the Word and prayer could continue with focus.

> Organize practical ministry faithfully so spiritual ministry can flourish.

---

## Core Principles

ACTSIX is shaped by the following principles:

* **Clarity over complexity** — workflows should reduce mental clutter, not add to it.
* **Fast capture** — users should be able to record what has their attention without friction.
* **Intentional clarification** — captured items should be processed into the right workflow at the right time.
* **Ministry-specific structure** — the app should reflect real church work, not generic productivity categories only.
* **Calm visual design** — the interface should feel focused, quiet, and usable.
* **Modular growth** — each ACTSIX branch should have its own dashboard, tools, and workflows.
* **Stewardship-focused technology** — the goal is not more software for its own sake, but better support for faithful ministry.

---

## Current Product: ACTSIX Tasks

**ACTSIX: Tasks** is the first functional module in the ACTSIX family.

It is a ministry-focused task management system influenced by GTD-style workflows.

### Homebase

The ACTSIX Homebase provides a high-level overview of the ACTSIX family.

It is separate from the Tasks module and is designed to surface key information from each future module, such as:

* urgent tasks
* project counts
* upcoming service planning details
* next sermon information
* pastoral care follow-ups
* meeting reminders

### Tasks Dashboard

The Tasks Dashboard is the entry point into ACTSIX: Tasks.

It gives users an overview of their active task workflow, including:

* inbox items
* next actions
* projects
* waiting-for items
* someday/maybe items
* highest-priority work

### Inbox

The Inbox is designed for fast, raw capture.

Items added to the Inbox remain unassigned until clarified. They do not receive task properties until the user chooses where the item belongs.

Inbox items can later be processed into:

* Next Action
* Project
* Waiting For
* Someday / Maybe
* Meeting, planned

### Next Actions

Next Actions contains work that can be done now.

Features include:

* compact smart task rows
* search
* date views: All, Today, This Week, No Date, Overdue
* collapsible filters
* project and context selection
* priority, energy, duration, due date, and tags
* completed task collapse/expand

### Projects

Projects represent outcomes that require more than one action.

Features include:

* project directory view
* individual project detail pages
* project progress tracking
* linked next actions
* project notes
* project editing
* related task management

### Waiting For

Waiting For tracks delegated or dependent items.

Features include:

* item title
* person or team responsible
* follow-up date
* related project
* edit modal
* delete action

### Someday / Maybe

Someday / Maybe holds ideas and possibilities that are not active yet.

Features include:

* idea title
* category
* notes
* edit modal
* delete action

---

## Planned ACTSIX Modules

ACTSIX is intended to become a family of focused ministry tools.

Planned modules include:

* **ACTSIX: Meetings** — agendas, minutes, decisions, attendees, and action points.
* **ACTSIX: Service Planning** — worship services, songs, teams, roles, readings, and production notes.
* **ACTSIX: Sermon Prep** — sermon ideas, outlines, manuscripts, illustrations, research, and delivery notes.
* **ACTSIX: Scripture Tools** — Scripture formatting, reading preparation, passage comparison, and service-ready Bible text.
* **ACTSIX: Media Tools** — media preparation, audio workflows, song analysis, and creative production tools.
* **ACTSIX: People Care** — pastoral follow-ups, prayer needs, visits, and care responsibilities.
* **ACTSIX: Worship Resources** — songs, keys, tempos, arrangements, team preparation, and worship planning support.
* **ACTSIX: Documents** — templates, policies, training documents, and repeatable ministry resources.

---

## Design Direction

ACTSIX uses a calm, modern, ministry-focused design system.

The interface is designed to feel:

* focused
* premium
* quiet
* readable
* structured
* fast

The visual language uses:

* warm neutral backgrounds
* charcoal structure
* muted teal accents
* sage, sand, and bronze supporting tones
* compact layouts
* generous readability
* reduced visual noise

---

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* React Router
* TanStack Query
* Lucide Icons

### Backend

* Supabase

---

## Project Structure

```txt
src/
├── assets/
├── components/
├── hooks/
├── integrations/
├── lib/
└── pages/
```

Key areas:

```txt
src/pages/              Main application views
src/components/         Shared UI and workflow components
src/integrations/       Supabase integration
src/lib/                Shared helpers and utilities
src/assets/             Branding and visual assets
```

---

## Running Locally

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

---

## Git Workflow

Before starting work:

```bash
git pull
```

After making changes:

```bash
git add .
git commit -m "type: describe the change"
git push
```

Recommended commit prefixes:

```txt
feat:      new feature
fix:       bug fix
ui:        layout or visual adjustment
style:     color, typography, spacing, or design-token work
refactor:  internal cleanup without changing behavior
docs:      documentation changes
```

Examples:

```txt
feat: add project detail pages
fix: keep inbox capture raw until clarified
ui: refine workspace switcher
style: align app with ACTSIX brand palette
docs: update README
```

---

## Branding

ACTSIX branding centers on:

* stewardship
* structure
* clarity
* ministry support
* thoughtful organization
* quiet confidence

The ACTSIX mark represents organized parts working together around a centered purpose.

---

## Long-Term Goal

The long-term goal of ACTSIX is to become a unified ministry operating platform that helps churches:

* organize practical ministry work
* reduce administrative overload
* improve team communication
* track responsibilities clearly
* support better stewardship
* prepare services, sermons, meetings, and care workflows in one ecosystem
* free leaders to focus more deeply on people, prayer, discipleship, and the Word

---

## Current Status

ACTSIX is under active development.

The **ACTSIX Alpha** scope is focused on Homebase, Tasks, Meetings, Service Planning, and People.

The local meeting transcriber is intentionally held back from Alpha. It remains in the repository as experimental local tooling, but it is hidden from the app unless `VITE_ACTSIX_TRANSCRIBER_ENABLED="true"` is set.

The **ACTSIX: Tasks** module is functional and continues to expand. The Homebase and module architecture are being shaped to support the broader ACTSIX family.

---

## License

Private project.

All rights reserved.
