# TODO

Work through one item at a time. Tick items off as they are done.

## Setup wizard

Full-page steps, IKEA-planner style: Welcome → New vs. existing → Equipment → Stations → Floor shape → Planner.

### A. Wizard frame
- [x] 1. `screen` value in the store (`welcome` | `wizard` | `planner`) plus a `setup` object for the answers. Replaces the forced "New floor" dialog on first load; the top-bar "New floor" button restarts the wizard.
- [x] 2. Reusable full-page step layout: Saab styling, "Step N of 4" progress bar, Back/Next, Next disabled until the step is valid.

### B. Steps
- [x] 3. Welcome page: intro text and a "Start planning" button.
- [x] 4. New vs. existing: two large choice cards; "Edit existing layout" shown but disabled ("coming soon").
- [x] 5. Equipment: multi-select category cards. Needs a `category` on each catalog machine (catalog data, not `types.ts`).
- [x] 6. Stations: target station count (stepper, sensible default).
- [x] 7. Floor shape: name, shape cards (Rectangle, Chamfered corner, L-shape/indent) with a live 2D preview and per-shape size inputs.

### C. Floor shapes in the planner
- [x] 8. Optional `outline` polygon on `Floorplan` in `types.ts` + zod schema. (Backend not started yet, so no coordination needed.)
- [x] 9. Draw the polygon floor on the canvas instead of a rectangle.
- [x] 10. Geometry/validation: "inside the floor" as a polygon check; exits snap to the nearest polygon edge.
- [x] 11. Hall settings: resizing a non-rectangular floor scales the shape to the new bounding box.

### D. Answers change the planner
- [x] 12. Catalog shows the chosen equipment categories first; everything else under a collapsed "Other".
- [x] 13. Station goal counter in the top bar, e.g. "4 / 7 stations · 0 warnings" (seed for the later challenge idea).

## Pillars

Fixed building columns: rectangular, 0.5 × 0.5 m by default, size editable per pillar. Placed one by one in the planner and/or as a regular grid from the wizard. Movable, with a lock.

- [x] 14. Data model: `Pillar` interface + zod schema in `types.ts` (id, centre x/y, width, depth, mm); `pillars` list in the store with add/move/resize/remove; cleared by `newFloorplan`.
- [x] 15. Canvas: draw pillars as dark grey hatched blocks (building element, not equipment); select and drag like utilities.
- [x] 16. Catalog: "Structures" section with a Pillar item, placed with the ghost like machines and utilities.
- [x] 17. Properties panel: selected pillar's width/depth in metres, delete button.
- [x] 18. Lock toggle in the top bar ("Lock structures", covers pillars and later walls): when on, structures can't be dragged or selected, so they don't get in the way while placing machines.
- [x] 19. Validation: machine body on a pillar = clash; pillar in a machine's clearance = blocks clearance; pillar outside the floor = warning. Shown with the existing red outline and warning count.
- [x] 20. Wizard floor step: optional "Pillar grid" (on/off, spacing x/y in m, pillar size), drawn in the live preview; creates the pillars with the floor, skipping any that would fall outside a shaped floor.

## Internal walls

Straight wall segments inside the hall, drawn by clicking a start and an end point. Horizontal/vertical only, with a thickness (default 0.2 m). No doorways for now: leave a gap between segments to make an opening. Grouped with pillars under "Structures" and covered by the same lock.

- [x] 21. Data model: `Wall` interface + zod schema in `types.ts` (id, start/end points, thickness, mm); `walls` list in the store with add/move/update/remove; cleared by `newFloorplan`.
- [x] 22. Drawing: "Wall" item in Structures; click start, live preview follows the cursor (snapped to horizontal/vertical, length shown), click end to finish; Esc cancels.
- [x] 23. Canvas + editing: walls drawn as solid charcoal bars; select, drag to move; properties panel shows length and thickness (m) and a delete button.
- [x] 24. Machine clashes: a machine body on a wall = clash; a wall in a machine's clearance = blocks clearance; a wall outside the floor = warning.
- [x] 25. Utility reach: water/power/sprinkler only reach a machine with a clear line from the utility that no wall crosses. Coverage circles are cut off behind walls.
- [x] 26. Exit distance: measured as the walking route around internal walls and machines (gaps under 0.8 m count as closed; routes go around the inner corner of an L-shaped floor).

## Layers

Decided: water and power lines are drawn automatically from the existing reach rules (nearest point in reach feeds the machine); power points are the electrical hubs; fire extinguishers are a new utility with a walking-distance rule; switching a layer off hides its lines, coverage and routes but leaves the utility icons visible and clickable. The selected item always shows its own coverage/route/lines.

- [x] 27. Layers menu: a "Layers" button in the top bar opens a popover with four switches (Water, Electrical, Fire safety, Exit routes), replacing the "Coverage" and "Exit routes" switches. Each layer shows its utilities' coverage; exit routes move under their layer.
- [x] 28. Water layer: a line from each water point to every machine it feeds, in the water colour.
- [x] 29. Electrical layer: a wire from each power point to every machine it feeds, plus a load tag on each power point (e.g. "42 / 63 kW", red when overloaded).
- [x] 30. Fire extinguisher: new utility (catalog item, icon, properties). Every machine must be within its walking distance (default 25 m, editable per extinguisher), measured like exits; a warning and "needs" badge when none is in reach.
- [x] 31. Fire safety layer: sprinkler coverage plus the walking route from each machine to its nearest extinguisher.

## Up next (to plan)

Priority from the organisers: the layout itself, simple, fun and easy to use. Simulation (animated flows) is only a bonus. Sections below are in the planned order.

Kickoff brief (Saab, hackathon 2026): a user-friendly tool that gives a good understanding of the **production flow between jigs** and the **work performed in each jig**; start from a 2D building drawing; a library of workshop equipment with editable L/W/D; colour, text and dimensions on objects; snapping; multi-select; pan/zoom; measure. Optional: coloured, labelled floor areas, area between points, comments, export a 2D layout. Assembly workshops are the hardest case (10s of jigs, 2–3 people per jig, benches, tools). We stay in 2D. Demo video due on the hack day, Nov 28 16:30; finals Dec 10. Jury: does it address the needs, creativity, potential, "would we move forward with this?"

Persona (UX): Victoria Andersson, production technician at Saab Aeronautics — "I want to test ideas quickly without spending hours preparing models." Needs: change layouts quickly, experiment without losing work, understand space limits and dimensions (incl. heights), compare alternatives, collect colleagues' feedback. Dislikes complicated programs, CAD preparation, and finding space problems late.

UI rule of thumb (for Victoria: "few menus"): new features shouldn't each add a top-bar control or a new menu; prefer actions next to the selected item, keyboard shortcuts, and folding options into existing panels.

### Conveyors

Decided: conveyors are pieces placed one at a time (straight belts and corners), like other machines; every piece has a flow direction shown with arrows; pieces snap output-to-input only; no snapping to machines yet; a connected run has one drive (power counted once per run, by belt length) and its pieces don't clash with each other's clearance.

- [x] 32. Data model: catalog conveyor pieces — "Belt conveyor" (straight, length per piece, 1–30 m, default 3 m) and "Conveyor corner" left/right (0.8 × 0.8 m) — replacing the fixed 6 m section. `length` on the placed machine; body, clearance, clashes and routes use it.
- [x] 33. Length input: a length field on the straight belt in the catalog (used for the next placement) and in the properties panel for a placed belt.
- [x] 34. Canvas look: belts drawn with rollers and flow arrows; corners as a curved quarter turn with an arrow; rotation turns the flow.
- [x] 35. Snapping: while placing or dragging a piece, its input snaps onto a nearby free output (or its output onto a free input) when the flow directions line up; free ends are marked.
- [x] 36. Runs: connected pieces form one run. No clearance clashes between pieces of a run; power is counted once per run (0.25 kW per metre of belt) from one power point that reaches any piece, with one wire; the properties panel shows the run (pieces, total length, power).
- [x] 37. Machine fronts: a conveyor end snaps to the middle of a machine's front (feeding into it, or taking goods out of it); one conveyor per front; a joined belt and machine don't block each other's clearance; free fronts are marked while a conveyor piece is being placed or dragged.
- [x] 38. Moving runs: dragging a conveyor piece moves its whole run (outlined together when selected, and the run's free ends snap); double-click a piece to move it on its own.
- [x] Machines snap onto belt ends too: dragging or placing a machine near a free conveyor end puts the middle of its front on it, turned to face the belt (taking goods off an output, or feeding an input), so a run can go from one machine to another.

### Autosave
- [x] Keep the current layout (floor, machines, utilities, structures, wizard answers) in the browser and restore it after a refresh or a closed tab, so no work is lost. Saved quietly on every change; "New floor" still starts fresh. First piece of saved projects.

### Editing
- [x] Undo / redo: Ctrl+Z / Ctrl+Shift+Z (and Ctrl+Y) plus buttons in the top bar, covering every change to the layout (machines, utilities, structures, floor size); a drag counts as one step.
- [x] Multi-select: click-and-drag on empty floor draws a selection box; everything inside is selected and can be dragged together (Shift-click adds/removes). Delete removes the selection.

### Compare projects

Decided: the floor name in the header is the project switcher (no new header buttons); a duplicate is named "<name> (copy)" and opens straight away (rename from the menu); compare is a full page with both floors side by side and a table of figures.

- [x] 39. Projects in the store: the open project plus a list of other saved projects (each: floor, machines, utilities, pillars, walls, wizard answers), all autosaved. The wizard's "New floor" creates a new project instead of replacing the current one. Undo history resets when switching project.
- [x] 40. Project switcher: click the floor name in the header for a menu — list of projects (click to open), Duplicate, Rename, Delete (with confirm), Compare….
- [x] 41. Compare screen: pick two projects; both floors drawn side by side at the same scale (view only); a table of key figures (stations, warnings, floor area used, longest walk to an exit, total power, conveyor length) with the better value highlighted; an "Open" button under each.
- [x] 42. Export / import a project as a JSON file (in the switcher menu), for sharing until the backend can sync.

### Fixes after the merge of PR #19 (free rotation)
- [x] Conveyor joins compare flow directions exactly, but rotation now uses cos/sin (cos 90° = 6e-17, not 0). Result: a corner no longer joins a belt turned 90°/270°, and a belt flowing up (270°) doesn't snap into a machine front. Fix: compare directions with a small tolerance (or round them).

### Production flow (kickoff: "flow between jigs") — paused for now
- Process order: give stations a step number (in the properties panel, or by clicking stations one after another in a "flow" mode). Several products/flows can come later.
- Flow view: arrows from station to station in process order, drawn along the walking routes (around walls and machines), with each leg's distance and the total travel distance. Conveyor runs between stations count as part of the flow. A static view, not a simulation — shown as its own layer.
- Figures: total flow distance (also in the compare table), and the longest leg highlighted, so a tangled layout is easy to spot.

### Object details (kickoff: "work performed in each jig", "colour, text, dimensions")
- [x] Auto-numbered short names by type on the canvas ("CNC 01", "BELT 02") — on master (PR #19, `machineLabels.ts`).
- [x] Editable size per placed item: width, depth, height (height not used by 2D checks yet) and clearance per side — on master (PR #19).
- [x] Own name/label per item (e.g. "M1", "Jig 3 – wing spar"), replacing the auto name when set.
- [x] Work description per item (free text) and number of people working there; shown in the properties panel and as a tooltip on hover.
- [x] Colour per item (a small palette), e.g. to mark which product line it belongs to.

### Zones (kickoff: "mark floor areas with colours and text"; replaces keep-clear aisles and height limits)

Decided: a zone is selected and moved by its name tag (dragging elsewhere inside it still draws the select box, and machines in it stay clickable), resized with corner handles; catalog machines get typical heights (editable per machine) so height limits always work; a "Zones" layer, on by default.

- [x] 43. Data model: `Zone` (id, name, kind: area / aisle / height limit, rectangle x/y/width/depth, colour, maxHeight for height limits) + zod schema; `zones` in the store with add/update/remove; part of projects, autosave, export/import, undo, duplicate and compare previews. Typical heights for every catalog machine.
- [x] 44. Drawing: a "Zone" item in Structures; click-drag on the floor draws the rectangle (live size shown), Esc cancels; the new zone is selected so it can be named straight away.
- [x] 45. Canvas: tinted fill and coloured border (aisles hatched); a name tag in the top-left corner with the area in m²; click the tag to select, drag it to move; corner handles resize the selected zone; a "Zones" layer. Drawn under machines.
- [x] 46. Properties panel: name, type, colour, max height (height limits), position and size, area, delete; Delete key and undo work as for other items.
- [x] 47. Rules: a machine body in a keep-clear aisle → "CNC 01 stands in the keep-clear aisle "Main aisle"."; a machine taller than a height limit it stands under → "CNC 01 (3.2 m) is taller than the 3.0 m height limit "Mezzanine"."

### Equipment library (assembly first)
- [x] Machines have a typical height (done with zones). Catalog search is on master (teammates).
- [x] 48. New equipment (sizes from the example layout's legend) in seven categories, two new — Welding & sheet metal, Storage & logistics: assembly jig large (6 × 3 m) and small (3 × 2 m), heavy work bench, assembly table, quality-control table; pillar drill, metal band saw; welding table, grinding bench, press brake; hydraulic press 30 t; tool cabinet, tool trolley, storage shelf / pallet rack, EUR-pallet spot, chemicals cabinet; parts washer. Each with size, clearance, power, water/fire needs and height.
- [x] 49. Typical people per station (jigs 2–3, benches 1), used when the station has no own number. Storage items (cabinets, trolleys, shelves, pallets) don't count as stations in the goal counter or compare table, like conveyors.
- [x] 50. Canvas: short names for the new types ("JIG 01", "BENCH 02", "SHELF 01") and a simple mark on each so types are told apart at a glance (jig frame, bench vice, pallet cross, shelf stripes, …).

### View and measure (kickoff: "pan, zoom", "measure between points")
- Zoom (scroll, +/− in the map toolbar, zoom level, fit-to-screen) and pan (drag with Space held or the middle mouse button).
- Measure tool: click two points to see the distance; snaps to item edges and corners. Optionally the area of a rectangle.
- Dimension rulers along the floor edges.

### Drawing underlay (kickoff: "start from a 2D drawing of the building")
- Load a PDF page or an image (PNG/JPG) of the building drawing under the floor; set its scale by clicking two points and typing the real distance; adjust opacity and lock it. Trace walls and place machines on top.

### Doors in internal walls
- Doors and openings in internal walls (with a door-swing symbol, as in the example layout); walking routes pass through them.

### Export the layout (kickoff: "export a new 2D layout")
- Export the floor as a PNG and/or PDF, with a title block (name, size, date), scale bar and a legend of items.

### Free rotation
- [x] `rotation` is any angle in degrees (0–359) in types and schema; R and the "Rotate 15°" button turn in 15° steps; machines are drawn at their angle — on master (PR #19).
- [x] Clash checks, clearance, reach and walking routes work with a rotated machine's enclosing upright box — on master (PR #19).
- [x] Fixed (rotated-rectangle checks for clashes, clearance, floor edge and reach; walking routes, supply lines and box select still use the enclosing box). Was: the enclosing box is bigger than the machine at angles other than 0/90/180/270 (≈ 40 % wider at 45°), so angled machines get false "overlaps" / "blocks the clearance" warnings near their corners. Proper fix: rotated-rectangle checks (separating-axis test), ~0.5–1 day.
- [ ] Angle field in the properties panel (type any angle) and/or a rotate handle on the selected machine; R could stay at 90° with 15° on Shift+R.

### Ease of use
- Alignment guides: while dragging, dashed guide lines appear when a machine lines up with another's edge or centre, and it snaps gently onto them; a distance label (e.g. "1.2 m") shows the gap to the nearest neighbour.
- Drag from the catalog: drag an item straight onto the floor, as well as click-then-place.
- Quick actions: a small floating bar next to the selected item (Rotate, Duplicate, Comment, Delete), plus shortcuts: R rotate, Ctrl+D duplicate, arrow keys to nudge (Shift for bigger steps).
- [x] Example workshop (Saab's 22 × 13 m drawing V-2026-02), opened from the welcome page or the project menu. Still open: more templates (e.g. an assembly hall), and offering them in the wizard. Was: ready-made templates in the wizard (e.g. the example 22 × 13 m mechanical workshop, an assembly hall) to start from instead of an empty hall.
- First-time hints: two or three short tips the first time someone places a machine (drag to move, R to rotate, red means it needs more space), dismissable and shown once.
- Wizard "Edit an existing layout": open a saved project or import a project file.

### Comments (working together)
- [x] Comments on an item or pinned to a spot on the floor, with author, time and open/resolved status; markers on the canvas; a "Discussion" section listing them; saved with the project in the browser — on master (PR #19).
- [ ] Sharing between people (needs the backend to sync plans); replies/threads if wanted.

### Open floor shapes
- A floor side can be marked open (no wall) where the hall continues into an adjoining area, e.g. a corridor or another hall. Drawn as a dashed edge; machines may not cross it, but walking routes can leave through it (counts like a wide exit), and exits don't snap to it. Chosen per side in the wizard's floor step and editable in the planner.

### Design rework

Inspiration (Factory Runs screenshot): light, schematic look instead of solid blue boxes. Candidates only: we pick which parts to use when we get to this section.

- Machines: light rounded "cards" with a soft border, an inner schematic hinting at the type (e.g. spindle circle and control panel for CNCs, jig points for assembly), short numbered names ("CNC 01", "Assembly 05") with dimensions underneath, and an arrow showing the front/flow direction. Warning state: red-tinted card with a red border.
- Clearance: every machine's clearance drawn as a faint dashed rounded outline (not only when selected); red-tinted when it clashes.
- Floor: warm off-white floor with a subtle grid, a thick grey building outline, and a small "Grid: 0.5 m per square" note.
- Bottom status bar: legend for the zone colours (clear aisle, height limit, clearance, warning) and a summary such as "4 spatial checks flagged".
- Possible: a blueprint view toggle — classic blueprint blue background with a fine white grid, and white line sketches of the floor, walls, machines and utilities (outlines only, no fills).

### Fun
- Layout score: a live grade (S/A/B/…) in the top bar from warnings, floor-space use, walking and flow distances; tells you what would raise it.
- Juice and sound: soft "thunk" on placing, a click when conveyors snap, a small wobble on a clash, a chime when the goal is reached; a mute toggle.
- Achievements: small badges with the confetti, e.g. "Zero warnings", "Fire marshal" (every machine within 15 m of an exit), "Lean line" (one continuous conveyor run).

### Bonus (only if there's time)
- Fire drill: workers walk from every machine to the nearest exit along the walking routes, with an evacuation timer.
- Run the factory: boxes travel along the production flow and conveyor runs between machines; a machine with input but no output piles up and shows as a bottleneck.

### Polish the lines (potential)
- Snap the 90° turns of water pipes and power wires to the floor grid.
- Measure utility reach by the drawn pipe/wire length instead of the straight-line reach circle.

## Later (parked)
- Limitations step and review page
- Kickoff optional ideas not planned (3D-only or out of scope for 2D): lighting/transparency, kinematics, scanned objects, first-person view, fly-through, animations, STEP/IGES export, VR, basic CAD for custom shapes
- Other ideas from the Factory Runs concept: challenges, runs + knowledge vault, run archive
