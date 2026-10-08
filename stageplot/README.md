# Stageplot

Weekly church stage layout builder. Single HTML file, no install, no server.

Open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox).

## What it does

- **Stage & room**: set stage width/depth and house depth/width in feet. 1 ft grid, heavy line every 4 ft (4×8 deck panels). Rulers, upstage/downstage, stage left/right marked.
- **Team → stage**: add this week's team (or paste a schedule from Planning Center / a spreadsheet: `Name - Position` per line). Press **Build stage from team** and each person's gear is placed by position: drums + riser + shield, bass amp + DI, guitar amp + pedalboard, keys, tracks laptop, vocal mics, IEM packs, pulpit + headset, etc. Gear you drag keeps its spot on rebuild.
- **Gear library**: mics, DIs, wedges, IEMs, mains, subs, stage boxes / digital snakes, FOH and monitor consoles, IEM racks, power distros, outlets, risers, cameras, lights. Every item has editable size, rotation, inputs, watts, owner.
- **Cable runs**: XLR, Cat6 (digital snake), power, ¼″, Speakon, SDI/HDMI. Run by hand (Run cable → tap start → tap floor for bends → tap end) or auto-cable: inputs → nearest stage box with free ports, power → least-loaded circuit on nearest distro, stage boxes → FOH over Cat6. Lengths follow the floor at right angles plus slack % and drop at each end, then round up to stock lengths.
- **Power distro**: circuits × amps × volts per distro; per-circuit load meters; warnings at 80% and over breaker.
- **Paperwork**: input list with stage box port patching, outputs, monitor mixes, cable pull list, power sheet, team. Each table copies straight into a spreadsheet.
- **Weeks**: every week saved separately. *Next week (copy)* clones everything; *Next week (stage only)* keeps the room and infrastructure and clears the team.

## Saving

Weeks auto-save in the browser (localStorage). Use **Save / load** to copy or download JSON as a backup or to move to another computer.

## Shortcuts

`C` run cable · `Esc` cancel · `R` rotate (Shift+R 45°) · `Del` delete · arrows nudge 3″ (Shift 1 ft) · `Ctrl/Cmd+Z` undo
