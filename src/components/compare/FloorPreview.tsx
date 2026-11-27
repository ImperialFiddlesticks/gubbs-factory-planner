import { Group, Layer, Line, Stage } from 'react-konva'
import { MachineBody } from '@/components/canvas/MachineNode'
import { PillarBody } from '@/components/canvas/PillarNode'
import { UtilityGlyph } from '@/components/canvas/UtilityNode'
import { WallBody } from '@/components/canvas/WallNode'
import { SCALE } from '@/constants'
import { floorCorners } from '@/lib/floorShapes'
import { machineName } from '@/lib/machineLabels'
import { findLayoutIssues, idsWithIssues } from '@/lib/validation'
import type { Project } from '@/store'
import { CANVAS } from '@/theme'

/**
 * A view-only drawing of a project's floor: outline, walls, pillars, machines (red outline on
 * a clash) and utilities. Drawn at `pxPerMm` so two previews can share one scale; centred in
 * a width × height box.
 */
export function FloorPreview({
  project,
  pxPerMm,
  width,
  height,
}: {
  project: Project
  pxPerMm: number
  width: number
  height: number
}) {
  const { floorplan, machines, utilities, pillars, walls } = project
  // Everything is drawn in planner coordinates (mm × SCALE), then scaled to the preview.
  const fit = pxPerMm / SCALE
  const x = Math.round((width - floorplan.width * pxPerMm) / 2)
  const y = Math.round((height - floorplan.depth * pxPerMm) / 2)
  const floorPoints = floorCorners(floorplan).flatMap((p) => [p.x * SCALE, p.y * SCALE])
  const clashes = idsWithIssues(findLayoutIssues(machines, utilities, floorplan, { pillars, walls }), 'space')

  return (
    <Stage width={width} height={height} listening={false}>
      <Layer x={x} y={y} scaleX={fit} scaleY={fit} listening={false}>
        <Line points={floorPoints} closed fill={CANVAS.floor} />
        <Line points={floorPoints} closed stroke={CANVAS.floorStroke} strokeWidth={2} strokeScaleEnabled={false} />
        {walls.map((w) => (
          <WallBody key={w.id} wall={w} fit={fit} />
        ))}
        {pillars.map((p) => (
          <Group key={p.id} x={p.x * SCALE} y={p.y * SCALE}>
            <PillarBody width={p.width} depth={p.depth} fit={fit} />
          </Group>
        ))}
        {machines.map((m) => (
          <Group key={m.id} x={m.x * SCALE} y={m.y * SCALE}>
            <MachineBody
              typeId={m.typeId}
              length={m.length}
              width={m.width}
              depth={m.depth}
              colour={m.colour}
              label={machineName(m, machines)}
              rotation={m.rotation}
              outline={clashes.has(m.id) ? 'invalid' : 'none'}
              needs={[]}
              fit={fit}
            />
          </Group>
        ))}
        {utilities
          .filter((u) => u.kind !== 'sprinkler')
          .map((u) => (
            <Group key={u.id} x={u.x * SCALE} y={u.y * SCALE}>
              <UtilityGlyph utility={u} floorplan={floorplan} fit={fit} />
            </Group>
          ))}
      </Layer>
    </Stage>
  )
}
