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

## Later (parked)
- "Edit existing" path via JSON export/import
- Limitations step and review page
- Open floor shapes (one side open onto an adjoining area)
- Other ideas from the Factory Runs concept: challenges, runs + knowledge vault, run archive, keep-clear aisles, height-limit zones, undo/reset, catalog search, arrow-key nudging, example floors, drawing underlay, visible grid, comments, layout alternatives
