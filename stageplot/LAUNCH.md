# Launch readiness

Status of Stageplot for a public launch. Facts only: what has been checked, how, and what is still open.

## Verified

| Area | How it was checked |
|---|---|
| Core workflow: stage size and shape, team, build, gear placement, exact positions, rotation | End-to-end browser tests (Playwright, Chromium) |
| Audio and power cabling: auto-patch, hand-run cables, overhead and channel routes, cable lengths | End-to-end tests, including the overhead length adding the climb at both ends |
| Undo / redo, autosave, reload keeps stage, positions, cables, layers and properties | End-to-end test compares the saved plan before and after reload |
| Layers hide only the view, never the data; paperwork always shows everything | Test compares plan data before and after hiding every layer |
| Paperwork: printing (one sheet per page, no app chrome), sheets export, backup file | PDF render checked page by page; downloaded files opened and checked |
| Unreadable saved data is kept, not overwritten, and can be recovered | Test with deliberately corrupted storage |
| Unexpected errors show one calm notice | Test throws an error inside the page |
| Accessibility | axe-core 4.10: no violations in light or dark theme across welcome, plot, item details, gear library and paperwork |
| Phone (400 px), iPad portrait and landscape, desktop | No sideways scrolling; toolbar fits at each width |
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
