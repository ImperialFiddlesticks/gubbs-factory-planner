# Handoff notes (for Claude Code on another machine)

> **To Claude:** read this whole file before doing anything. It carries the context from the
> previous sessions on the user's desktop. Save the "How to work with me" and "Background"
> sections to your memory if you have one, then continue from "Where we are".

_Written 2026-11-27, the evening before the hack day._

## How to work with me
- **One step at a time.** Do the requested step, report what changed (and any decisions you made), propose the next step, then wait. Ask before adding anything extra, such as new dependencies, components, features or design choices.
- **For bigger feature sets, plan first:** agree on the ideas, put them in TODO.md, then build them one at a time.
- **I test every change in the browser myself.** Don't suggest browser testing or `/run`. Report typecheck, lint and build briefly.
- **I commit and merge myself.** Only commit when I ask. Work happens on feature branches, which are merged into `master` through PRs.
- **Checks after every change:** `npx tsc -b`, `npx eslint src`, `npx vite build`.
- **Testing logic without the browser:** small node scripts that load modules through Vite `ssrLoadModule`. Write the scripts to a scratch folder, not into the repo.
- **Shell tip (Windows):** for multi-line edits, write a script file and run it with node. Bash heredocs with nested quotes and backticks kept failing.

## Background
- **What:** a 2D factory and workshop layout planner for the **Saab Aeronautics hackathon 2026**, made with Saab × East Sweden Game.
  - It should feel game-like (Sims build mode, IKEA kitchen planner) but stay 2D. We're not 3D artists.
  - It uses Saab's brand colours: dark chrome panels and a light work area.
  - `types.ts` is a contract with the backend team, who prefer plain interfaces.
- **What Saab asked for:** the layout itself. It should be simple, fun and easy to use. Simulation and animated flow are only a bonus, because existing tools already do that and are too complicated.
- **The kickoff brief asks for:**
  - flow between jigs, and the work done at each jig;
  - starting from a 2D drawing;
  - an equipment library with editable L/W/D;
  - colour, text and dimensions on objects;
  - snapping, multi-select, pan/zoom and measuring;
  - optional: zones, comments in space, 2D export.
- **Jury criteria:** how well it addresses the needs, creativity, potential, and above all "is this something we would like to move forward with?"
- **Persona, Victoria Andersson:**
  - 42, a production technician at Saab in Linköping;
  - "I want to test ideas quickly without spending hours preparing models";
  - wants: fast changes, experimenting without losing work, space and height limits, comparing alternatives, collaborating;
  - dislikes: tools that need training, CAD preparation, and space problems found late.
- **Saab's example drawing:** a 22 × 13 m mechanical workshop (V-2026-02). It's rebuilt in the app as `src/data/exampleWorkshop.ts` and opened from the welcome page ("Open an example workshop").

## Deadlines
- **Hack day, 2026-11-28:** the ~5-minute demo video is due at **16:30**.
- **Finals:** live presentations on Dec 10.

## Demo video plan (decided 2026-11-27)
- **Format:** English voice-over over screen captures, recorded scene by scene and then cut together.
- **Focus:** simplicity and ease of use, **safety**, and **iteration** (undo, variants, compare, autosave).
- **Production flow** (in TODO.md) is a bonus at best. I may build it on the hack day if there's time; don't push it.
- **Rank remaining work** by how it shows in the video. Small polish that makes a scene smoother beats new features.

### The story: "Friday at Ten" (proposed, waiting for my feedback)
On **Monday at 07:42**, Victoria gets an e-mail from Erik, the production manager (fictional). Two new assembly jigs must fit into the already full Workshop 3, and he wants a layout on **Friday at 10:00**.

1. **Act 1:** the old way means CAD models and consultants. Instead she opens the example workshop.
2. **Act 2:**
   - She drops the jig, and it lands on a bench (red). She box-selects and slides the benches away, then uses undo/redo.
   - **Twist 1:** the second jig touches the main aisle and gets the aisle warning.
   - **Twist 2:** she draws a 3.0 m height-limit zone (the crane runway) over Zone 5, and the 3.5 m jig turns red.
   - **Twist 3:** with the exit-routes layer on, squeezing things in near the office cuts the office off from its exit.
   - **Breakthrough:** she moves the QC table, places jig 2, and connects them with a belt that snaps on (the table snaps and turns). She fills in the work text, the people and a colour.
3. **Act 3:**
   - **Wednesday:** a comment from "Magnus, maintenance" (fictional), marked resolved.
   - She duplicates the layout as "Option B" and compares the two; A wins.
   - **Friday 10:00:** the goal turns green, with confetti.
4. **Close:** "Simple. Safe. Iterative." with "From Monday's e-mail to Friday's decision: no CAD models, no consultants, no surprises on the shop floor."

**Preparation offered, not started:**
1. A "Monday" starting project: the example with the station goal *not* reached (e.g. 18 of 20), so placing the jigs triggers the confetti.
2. A script check that each twist really triggers its warning in the example, so we know the exact spots before recording.
3. A prepared "Option B" layout for the compare scene.
4. The e-mail and title cards, made in the video editor (not in the app).

## Where we are (code)
- **Branches:**
  - `master` is up to PR #23 (equipment library).
  - `example-workshop` (bd26b1c) is pushed but not yet merged.
  - `keep-on-floor` (40a43fc) is pushed, and holds:
    - machines can't be placed or dragged outside the outer walls (`src/lib/placement.ts`, `keepOnFloor`);
    - non-conveyor machines snap onto a free belt end and turn to face it (`snapMachineToConveyor` in `src/lib/conveyors.ts`, `moveMachineTo` in the store).
- **Next steps:**
  - the demo preparation above, if I approve the story;
  - otherwise, see **TODO.md**: production flow (bonus), measure tool and rulers, drawing underlay, PNG export, doors in walls, a free-rotation angle field, ease-of-use items, design rework, fun extras.

## Key code facts
- **State:** a zustand store (`src/store.ts`) with `persist` autosave to localStorage, validated with zod (`src/lib/autosave.ts`).
  - The open project is top-level state; the others live in `projects`. The project id is the floorplan id.
- **Undo/redo:** `src/history.ts` keeps 100 steps over the layout data and resets when the project changes.
- **Geometry:** rotated rectangles with a SAT overlap test (`src/lib/geometry.ts`). Layout checks are in `src/lib/validation.ts`.
- **Conveyors:** `in`/`out` ports, runs found with union-find, and snapping (`snapShift`, `snapConveyor`, `snapMachineToConveyor`).
- **Canvas:** Konva (`src/components/FloorCanvas.tsx`, `src/components/canvas/*`). Group drags are tracked in `DragState.group`.
- **Catalog:** `src/data/catalog.ts` has 25 items with categories, short names and heights. There are 7 categories in `src/data/categories.ts`.
- **Zones:** `area`, `aisle` and `height` kinds (`src/data/zones.ts`). A machine in an aisle, or taller than a height limit, gets a warning.
- **Projects:**
  - export/import as JSON (`gubbs-factory-project` v1);
  - a compare page (`src/components/compare/`);
  - comments (built by teammates).
