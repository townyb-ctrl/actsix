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
| Team role marks, concrete surface, names stepping aside | End-to-end test: every positioned team member gets a mark, the concrete slab and joints draw, six surface tiles show, and a name crowded above and below moves beside its item |
| Title block, Planning Center placeholders, Next up count-up | End-to-end test: Drawn by saves and appears in the title block with all seven fields, four placeholder rows show while the roster loads and clear after, the figures count up and settle on the right values and don't restart on a redraw |
| Drag lift, paperwork pages, library trends | End-to-end test: a dragged item lifts and scales, settles on drop and is plain after; the Pages switch turns white pages on and off and is remembered after a reload; trend lines draw with their numbers in the label |
| Feet and inches | End-to-end test: rulers, fields, typed values (20 ft stage, 12.5 ft position), pull list stock lengths, header and title block all switch; switching back gives metres again and the plan data is unchanged |
| Focus, role marks, empty sheets, pinch | End-to-end tests: picking a performer dims the rest and highlights only their cables; four role marks draw; five empty sheets show their message; the hover card is hidden off the plot; a simulated two-finger pinch zooms the plot 2× without zooming the page |
| Venues and logo | End-to-end test: an old library without venues migrates into one venue on reload; two venues added; a new week takes its venue's size and colour; the week arrows stay in the venue; moving a week swaps in the other venue's stage; Save to venue and Reset; Library venue chips filter; paperwork names the venue; a venue with weeks can't be deleted, an empty one can; backup carries venues; the logo shows in the header and on Home |
| Venues linked to Planning Center | End-to-end test with a mocked connector: link and unlink service types per venue, linking a type to a second venue moves it, importing a linked plan from a planned week starts a new week at that venue (the old week untouched), importing into an empty week moves it there, the open week's venue picks its service type first, backups keep the links; the Venues page is in the axe scan |
| Final full pass | Static check of the whole script (no undefined names, duplicate keys or unreachable code; dead drawing helpers removed with every symbol byte-identical); no duplicate element ids on any screen; a random-interaction stress test (about 10,000 clicks, typing, drags and keys over 25 runs at desktop, tablet and phone sizes) found two crashes, both fixed and covered by a regression test, and every run ends with intact data that reloads; every screen checked in light and dark, desktop and phone, metric and feet; the full paperwork prints as 9 pages on both A4 and US Letter with no app controls, the rider as exactly 1 page |
| Picking bunched cables | End-to-end test clicks every cable on the example stage where it is visible: before, 15 of 21 could be selected at stage zoom and 16 of 22 zoomed out; now all of them, at both zooms, with one extra click to step through a bunch |
| Printing where the dialog is blocked | End-to-end test: with print blocked, Print or PDF and Print the rider each offer a download; the files contain the right sheets, open on their own and have a Print button that is hidden on paper; when printing works, no note appears |
| UX review before shipping | First run to finished paperwork walked as a new volunteer, every dialog and panel checked; fixes covered by a test: no fold-badge tip over the welcome or stage designer, no green Ready before there is a team, blank Add person rows dropped when a list is pasted or the stage is built, stage size fields explain out-of-range or non-number values instead of jumping to a default, long gear names wrap in the details header instead of being cut off |
| Accessibility | axe-core 4.10: no violations in light or dark theme across welcome, plot, item details, gear library and paperwork |
| Phone (400 px), iPad portrait and landscape, desktop | No sideways scrolling; toolbar fits at each width |
| Performance | Typical week (28 items): about 14 ms per plot redraw, so dragging stays smooth; nearly 3× the gear (74 items, 62 cables): about 32 ms; the whole paperwork about 55 ms; first screen in under 1 s (Chromium, desktop); the app is about 800 KB, 285 KB compressed |
| Planning Center (Services): service types, plans, plan people | Argument names checked against the connector's schemas; response shapes confirmed with one read-only call each |

## Open before a public launch

- **Safari and Firefox**: still not run on a real device (only Chromium can run here). A code audit found no JavaScript newer than Safari 15; the CSS needs Safari 16.2+ / Firefox 113+ for colour mixing (older browsers now get a one-time notice). Touch: pinch-to-zoom and dragging were tested with simulated touches in Chromium; check both on a real iPad.
- **Hosting**: the app is one static HTML file; it needs a home (any static host) and a domain.
- **Storage is per browser**: there are no accounts or sync. Teams share plans by exporting files. Accounts and team sharing would be the next major step.
- **Planning Center outside Claude**: the import works when the app runs inside Claude with the Planning Center connector. A standalone site would need its own Planning Center OAuth app.
- **No analytics or error reporting**: nothing leaves the browser today, by design. Add an opt-in only if needed.

## Run the checks

The automated tests live outside this folder in the development session; they drive `index.html` with Playwright in Chromium. Symbols are regenerated with `node tools/export-symbols.mjs`.
