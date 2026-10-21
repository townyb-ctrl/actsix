# Launch readiness

Status of Stageplot for a public launch. Facts only: what has been checked, how, and what is still open.

## Verified

| Area | How it was checked |
|---|---|
| Core workflow: stage size and shape, team, build, gear placement, exact positions, rotation | End-to-end browser tests (Playwright, Chromium) |
| Home: library, setups, stage defaults, gear, Planning Center, preferences, data | End-to-end test (defaults feed new weeks, venue on paperwork, hidden gear and owned counts, backup carries settings, library actions, reset); every section checked at desktop and phone width with no sideways scroll; axe clean in light and dark |
| Load-in checklist, change summary, borrow list, notes, owner snapping, setups by service type, library editing, G/P keys | End-to-end test of each, including ticks surviving a reload and a setup laid out on a Planning Center import (mocked) |
| Views (whose gear, lighting wash, sightlines, sound coverage), walkways, stage surfaces, signal trace, side view, before/after slider, presentation mode | End-to-end test of each: overlays persist and never reach the paperwork, a cable across a walkway raises a check, the trace follows guitar → pedals → DI → stage box → desk and the player's in-ears, last week's plot has no duplicate ids or clickable items, presentation hides all chrome; phone width with no sideways scroll |
| Pro input list and exports, rider, smart guides, version history, smooth zoom | End-to-end test: input columns and phantom flags, both CSV downloads opened and checked, the rider prints on exactly one A4 page (normal print skips it), history records, folds repeats, names, restores, undoes the restore and survives a reload, a drag snaps to an equal gap with its marks shown, zoom buttons ease in and grid lines stay 1 px; axe clean on the rider and history |
| Fixed channel numbers and My spot cards | End-to-end test over three weeks: a player away leaves their channel spare, a new player in the same role takes it back, a typed number swaps two channels, mic changes survive a reload; existing test outputs unchanged. Cards: own gear lit, others faded, text summary, all cards print one per page; no sideways scroll on a phone; axe clean |
| Channel undo and history, spares in desk names, FOH pointer, My spot names and times, rider legend | End-to-end test: a channel swap undoes, redoes and appears in history, restoring the first version resets channels; Desk names lists the spare; the FOH pointer shows when the desk is off screen and scrolls to it; times typed in the week menu appear on cards; Planning Center plan times are read from the plan's included PlanTime records (shape confirmed with one read-only call); legend uses plot symbols |
| Offline and install | Served over HTTP: manifest loads, the service worker controls the page, and a reload with the network off still opens the app with its weeks |
| Audio and power cabling: auto-patch, hand-run cables, overhead and channel routes, cable lengths | End-to-end tests, including the overhead length adding the climb at both ends |
| Undo / redo, autosave, reload keeps stage, positions, cables, layers and properties | End-to-end test compares the saved plan before and after reload |
| Layers hide only the view, never the data; paperwork always shows everything | Test compares plan data before and after hiding every layer |
| Paperwork: printing (one sheet per page, no app chrome), sheets export, backup file | PDF render checked page by page; downloaded files opened and checked |
| Unreadable saved data is kept, not overwritten, and can be recovered | Test with deliberately corrupted storage |
| Unexpected errors show one calm notice | Test throws an error inside the page |
| Accessibility | axe-core 4.10: no violations in light or dark theme across welcome, plot, item details, gear library and paperwork |
| Phone (400 px), iPad portrait and landscape, desktop | No sideways scrolling; toolbar fits at each width |
| Performance | Typical week (46 items, 30 cables): about 14 ms per redraw, so dragging stays at 60 fps; three times the gear: about 38 ms; first paint about 1 s (Chromium, desktop) |
| Planning Center (Services): service types, plans, plan people | Argument names checked against the connector's schemas; response shapes confirmed with one read-only call each |

## Open before a public launch

- **Safari and Firefox**: not tested yet (only Chromium was available). The app uses modern CSS (`color-mix`, container queries) that needs Safari 16.2+ and Firefox 113+.
- **Hosting**: the app is one static HTML file; it needs a home (any static host) and a domain.
- **Storage is per browser**: there are no accounts or sync. Teams share plans by exporting files. Accounts and team sharing would be the next major step.
- **Planning Center outside Claude**: the import works when the app runs inside Claude with the Planning Center connector. A standalone site would need its own Planning Center OAuth app.
- **Metric only**: sizes and lengths are shown in metres; there is no feet and inches option yet.
- **No analytics or error reporting**: nothing leaves the browser today, by design. Add an opt-in only if needed.

## Run the checks

The automated tests live outside this folder in the development session; they drive `index.html` with Playwright in Chromium. Symbols are regenerated with `node tools/export-symbols.mjs`.
