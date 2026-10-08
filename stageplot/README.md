# Stageplot

Weekly church stage layout builder. Single HTML file, no install, no server.

Open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox).

## What it does

- **Stage & room**: set stage width/depth and house depth/width in metres. 50 cm grid, heavier line every 1 m (2×1 m deck panels). Rulers, upstage/downstage, stage left/right marked.
- **Planning Center import**: when opened in Claude (as a published artifact), pick a service type and plan, tick who's on stage, and the team is pulled from Services through your Planning Center connector. Positions map to stage roles automatically; people on two positions (e.g. Keys + Vocals) become "Keys, also sings".
- **Team → stage**: add this week's team by hand, or paste a schedule (`Name - Position` per line). Press **Build stage from team** and each person's gear is placed by position: drums + riser + shield, bass amp + DI, guitar amp + pedalboard, keys, tracks laptop, vocal mics, IEM packs, pulpit + headset, etc. Gear positions are remembered per stage role, so next week's drummer lands where you put this week's kit.
- **Gear library**: mics, DIs, wedges, IEMs, mains, subs, stage boxes / digital snakes, FOH and monitor consoles, IEM racks, power distros, outlets, risers, cameras, lights. Every item has editable size, rotation, inputs, watts, owner.
- **Cable runs**: XLR, Cat6 (digital snake), power, ¼″, Speakon, SDI/HDMI. Run by hand (Run cable → tap start → tap floor for bends → tap end) or auto-cable: inputs → nearest stage box with free ports, power → least-loaded circuit on nearest distro, stage boxes → FOH over Cat6. Lengths follow the floor at right angles plus slack % and drop at each end, then round up to metric stock lengths.
- **Power distro**: circuits × amps × volts per distro (default 16 A @ 230 V); per-circuit load meters; warnings at 80% and over breaker.
- **Paperwork**: input list with stage box port patching, outputs, monitor mixes, cable pull list, power sheet, team. Each table copies straight into a spreadsheet.
- **Weeks**: every week saved separately. *Next week (copy)* clones everything; *Next week (stage only)* keeps the room and infrastructure and clears the team.

## Saving

Weeks auto-save in the browser (localStorage). Use **Save / load** to copy or download JSON as a backup or to move to another computer.

## Using it

- Drag the floor to pan; pinch or Ctrl+scroll to zoom. **Stage** / **Room** buttons refit the view.
- Drag gear from the Gear tab onto the stage, or click it to drop centre stage.
- The right panel shows a four-step checklist for the week (team → build → patch → power) with the next action button.
- Every change can be undone; toasts offer one-click undo. Theme follows your system or can be set with the half-circle button.

## Shortcuts

`V` move · `C` run cable · `Esc` cancel · `R` rotate (Shift+R 45°) · `D` duplicate · `Del` delete · `+`/`−` zoom · `0` fit · `?` help · arrows nudge 5 cm (Shift 50 cm) · `Ctrl/Cmd+Z` undo (add Shift to redo)
