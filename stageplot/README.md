# Stageplot

Weekly church stage layout builder. Single HTML file, no install, no server.

Open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox).

## What it does

- **Stage designer**: on first use, draw your stage outline (click corners, drag to adjust, `+` on an edge adds a corner) or start from a rectangle, thrust, curved-front or angled-corner preset. Change it any time from **Room → Draw or edit stage shape**, optionally for every saved week. Edges facing the audience get the gold spike-tape line.
- **Stage & room**: set stage width/depth and house depth/width in metres. 50 cm grid, heavier line every 1 m (2×1 m deck panels). Rulers, upstage/downstage, stage left/right marked.
- **Planning Center import**: when opened in Claude (as a published artifact), pick a service type and plan, tick who's on stage, and the team is pulled from Services through your Planning Center connector. Positions map to stage roles automatically; people on two positions (e.g. Keys + Vocals) become "Keys, also sings".
- **Team → stage**: add this week's team by hand, or paste a schedule (`Name - Position` per line). Press **Build stage from team** and each person's gear is placed by position: drums + riser + shield, bass amp + DI, guitar amp + pedalboard, keys, tracks laptop, vocal mics, IEM packs, pulpit + headset, etc. Gear positions are remembered per stage role, so next week's drummer lands where you put this week's kit.
- **Gear library**: mics, DIs, wedges, IEMs, mains, subs, stage boxes / digital snakes, FOH and monitor consoles, IEM racks, power distros, outlets, risers, cameras, lights. Every item has editable size, rotation, inputs, watts, owner.
- **Risers**: select a riser and drag a corner handle to resize it (10 cm steps, live size readout). Deck panels and legs are drawn at real size; set the riser height in the inspector.
- **Rack builder**: add a *Custom rack* (Gear → Snakes & desks, or Ctrl+K) and fill it from a library of rack gear: digital snakes, IEM transmitters, wireless receivers, patch bays, switches, amps, DSP, power and panels, plus custom devices. Pick the rack height, drag devices to reorder, add notes. A rack with a digital snake works as a stage box for patching; its IEM transmitters use its outputs; power is totalled. Racks get their own paperwork section.
- **Cable channels**: use the *Channel* tool (`T`) to draw floor trenches, cable trays or ramps. Auto-routed cables go through a channel when it keeps more of the run off the open floor; any cable can be set to run direct. Extend a channel with the + past either end (or start the Channel tool on its end); add a bend with the + on any edge.
- **Ceiling runs**: any cable can run along the ceiling (dashed on the plot); its length adds the climb up and down at each end using the ceiling height in Room. Speaker and sub feeds go overhead by default (toggle in Room). Draw an *Overhead truss* or *Ceiling tray* with the Channel tool for ceiling runs to follow. Hide or show ceiling runs from the Cables menu.
- **Power boards & extension leads**: 4-way and 6-way power boards and extension reels plug into a power point or distro, and gear plugs into them. Board loads count against the feeding circuit, outlets and the board's amp rating are checked, and daisy-chained boards are flagged. Auto-cabling uses a board when it's closer than mains and has a free outlet and headroom.
- **Cable runs**: XLR, Cat6 (digital snake), power, ¼″, Speakon, SDI/HDMI. Run by hand (Run cable → tap start → tap floor for bends → tap end) or auto-cable: inputs → nearest stage box with free ports, power → least-loaded circuit on nearest distro, stage boxes → FOH over Cat6. Lengths follow the floor at right angles plus slack % and drop at each end, then round up to metric stock lengths.
- **Power distro**: circuits × amps × volts per distro (default 16 A @ 230 V); per-circuit load meters; warnings at 80% and over breaker.
- **Paperwork**: input list with stage box port patching, outputs, monitor mixes, cable pull list, power sheet, team. Each table copies straight into a spreadsheet.
- **Weeks**: every week saved separately. *Next week (copy)* clones everything; *Next week (stage only)* keeps the room and infrastructure and clears the team.

## Stage-plot symbols

Every gear item is drawn as a real top-down symbol (drum kit with shells and cymbals, mic stands with booms, consoles with fader strips, stage boxes with XLR ports, distros with sockets, etc.). They live in `index.html` and are also exported as standalone files in [`symbols/`](symbols/README.md). After editing a symbol, run `node tools/export-symbols.mjs` to refresh the files.

## Saving

Weeks auto-save in the browser (localStorage). Use **Save / load** to copy or download JSON as a backup or to move to another computer.

## Using it

- **Search or jump to (Ctrl+K)**: run any action, add any gear by name, or find a person or item on stage.
- **Right-click** gear or a cable for quick actions (edit, run a cable from here, rotate, duplicate, assign to someone, hide that cable type, delete). **Double-click** gear to edit its details. Hover for a quick info card.
- Dragging gear snaps to line up with other gear and the stage centreline (pink guides). Hold Alt to move freely.
- The bottom dock holds Move, Run cable, the Cables menu, zoom and fit. A "Saved" tick in the header confirms every change is stored.
- **Cables** menu on the canvas hides all cables or single types (also `H`, or click a colour in the right panel's legend). Hidden types stay hidden in your browser until you show them again.
- Hide the left or right panel with the header buttons, `[` and `]`, or press `\` for focus mode (both hidden). The left panel shrinks to an icon strip; with the right panel hidden, a small card over the plot keeps rotate / duplicate / delete for whatever you select.
- Drag the floor to pan; pinch or Ctrl+scroll to zoom. **Stage** / **Room** buttons refit the view.
- Drag gear from the Gear tab onto the stage, or click it to drop centre stage.
- The right panel shows a four-step checklist for the week (team → build → patch → power) with the next action button.
- Every change can be undone; toasts offer one-click undo. Theme follows your system or can be set with the half-circle button.

## Shortcuts

`V` move · `C` run cable · `H` hide cables · `T` draw channel · `Esc` cancel · `R` rotate (Shift+R 45°) · `D` duplicate · `Del` delete · `+`/`−` zoom · `0` fit · `?` help · arrows nudge 5 cm (Shift 50 cm) · `Ctrl/Cmd+Z` undo (add Shift to redo)
