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

### Free rotation
- Machines can stand at any angle: a rotate handle on the selected machine and an angle field in the properties panel; snaps every 15° (stronger at 0/90/180/270), Shift for any angle; R / Rotate button still turn 90°. Conveyors stay at 90° steps for now.
- Needs: `rotation` becomes any angle in degrees (backend contract change — tell the backend team); clashes, clearance, inside-floor, utility reach, walking routes, supply lines, machine fronts and box select all work with rotated rectangles instead of upright boxes. Estimate ~1–1.5 days.

### Ease of use
- Alignment guides: while dragging, dashed guide lines appear when a machine lines up with another's edge or centre, and it snaps gently onto them; a distance label (e.g. "1.2 m") shows the gap to the nearest neighbour.
- Drag from the catalog: drag an item straight onto the floor, as well as click-then-place.
- Quick actions: a small floating bar next to the selected item (Rotate, Duplicate, Comment, Delete), plus shortcuts: R rotate, Ctrl+D duplicate, Delete, arrow keys to nudge (Shift for bigger steps).
- Example floors: ready-made templates in the wizard (e.g. "Small machining cell", "Assembly line") to start from instead of an empty hall.
- First-time hints: two or three short tips the first time someone places a machine (drag to move, R to rotate, red means it needs more space), dismissable and shown once.
- Catalog search: filter the catalog by name (needed once there are more machines).

### Comments (working together)
- Add a comment to anything on the plan: a machine, utility, structure, zone, or a spot on the empty floor.
- On the canvas a comment shows only as a small chat-bubble icon next to what it's about; clicking it opens the full comment.
- An "All comments" panel lists every comment, so the whole plan's discussion can be reviewed in one place; clicking one selects and shows its item.
- To decide when planning: author name on each comment, replies (threads), marking a comment resolved, and how comments are shared between people (needs the backend to sync; local-only until then).

### More machines
- Extend the catalog across the equipment categories (e.g. laser cutter, press brake, welding robot cell, injection moulding machine, CMM / inspection station, workbench, pallet racking, paint booth). Each with size, clearance, power, water/fire needs and height.

### Height limits
- Machines get a height. Height-limit zones (drawn as rectangles, with a max height) mark low ceilings, ducts or mezzanines; a machine taller than the limit of a zone it stands in gets a warning. Possibly a floor-wide ceiling height in the wizard too.

### Keep-clear aisles
- Aisle zones (drawn as rectangles, hatched green, labelled "Keep aisle clear") where no machine body may stand; a machine in an aisle gets a warning. Utilities and walking routes may use them.

### Open floor shapes
- A floor side can be marked open (no wall) where the hall continues into an adjoining area, e.g. a corridor or another hall. Drawn as a dashed edge; machines may not cross it, but walking routes can leave through it (counts like a wide exit), and exits don't snap to it. Chosen per side in the wizard's floor step and editable in the planner.

### Design rework

Inspiration (Factory Runs screenshot): light, schematic look instead of solid blue boxes. Candidates only: we pick which parts to use when we get to this section.

- Machines: light rounded "cards" with a soft border, an inner schematic hinting at the type (e.g. spindle circle and control panel for CNCs, jig points for assembly), short numbered names ("CNC 01", "Assembly 05") with dimensions underneath, and an arrow showing the front/flow direction. Warning state: red-tinted card with a red border.
- Clearance: every machine's clearance drawn as a faint dashed rounded outline (not only when selected); red-tinted when it clashes.
- Floor: warm off-white floor with a subtle grid, a thick grey building outline, and a small "Grid: 0.5 m per square" note.
- Dimension rulers along the top and left of the floor (e.g. "19 m", "11 m").
- Zoom controls in the corner: +, −, zoom level and a "fit" button (plus scroll-to-zoom and pan).
- Bottom status bar: legend for the zone colours (clear aisle, height limit, clearance, warning) and a summary such as "4 spatial checks flagged".
- Possible: a blueprint view toggle — classic blueprint blue background with a fine white grid, and white line sketches of the floor, walls, machines and utilities (outlines only, no fills).

### Fun
- Layout score: a live grade (S/A/B/…) in the top bar from warnings, floor-space use and walking distances; tells you what would raise it.
- Juice and sound: soft "thunk" on placing, a click when conveyors snap, a small wobble on a clash, a chime when the goal is reached; a mute toggle.
- Achievements: small badges with the confetti, e.g. "Zero warnings", "Fire marshal" (every machine within 15 m of an exit), "Lean line" (one continuous conveyor run).

### Bonus (only if there's time)
- Fire drill: workers walk from every machine to the nearest exit along the walking routes, with an evacuation timer.
- Run the factory: boxes travel along conveyor runs between machines; a machine with input but no output piles up and shows as a bottleneck.

### Polish the lines (potential)
- Snap the 90° turns of water pipes and power wires to the floor grid.
- Measure utility reach by the drawn pipe/wire length instead of the straight-line reach circle.

## Later (parked)
- "Edit existing" path via JSON export/import
- Limitations step and review page
- Other ideas from the Factory Runs concept: challenges, runs + knowledge vault, run archive, drawing underlay, visible grid
