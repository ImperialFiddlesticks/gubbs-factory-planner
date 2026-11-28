import { useState } from 'react'
import { StepLayout } from '@/components/wizard/StepLayout'
import { EquipmentStep } from '@/components/wizard/steps/EquipmentStep'
import { FloorShapeStep } from '@/components/wizard/steps/FloorShapeStep'
import { StationsStep } from '@/components/wizard/steps/StationsStep'
import { WhatToPlanStep } from '@/components/wizard/steps/WhatToPlanStep'
import { DEFAULT_FLOORPLAN } from '@/data/defaults'
import { shapeError, shapeOutline } from '@/lib/floorShapes'
import { pillarGridError, pillarGridPositions } from '@/lib/pillarGrid'
import { isValidStationTarget } from '@/lib/setup'
import { usePlanner, type SetupAnswers } from '@/store'

interface StepDef {
  /** Short label for the progress bar. */
  label: string
  title: string
  description: string
  content: React.ReactNode
  /** Whether Next is allowed with these answers. */
  isValid: (setup: SetupAnswers) => boolean
}

const STEPS: StepDef[] = [
  {
    label: 'What to plan',
    title: 'What do you want to plan?',
    description: 'You can change your answers later.',
    content: <WhatToPlanStep />,
    isValid: (s) => s.mode === 'new',
  },
  {
    label: 'Equipment',
    title: 'What type of equipment will you use?',
    description: 'Pick one or more. The catalog will show these first.',
    content: <EquipmentStep />,
    isValid: (s) => s.categories.length > 0,
  },
  {
    label: 'Stations',
    title: 'How many stations need to fit?',
    description: 'This becomes your goal in the planner.',
    content: <StationsStep />,
    isValid: (s) => isValidStationTarget(s.stationTarget),
  },
  {
    label: 'Floor shape',
    title: 'What shape is your floor?',
    description: 'Pick the shape closest to your hall, then enter its sizes.',
    content: <FloorShapeStep />,
    isValid: (s) =>
      s.floorName.trim() !== '' &&
      s.floorShapeSelected &&
      shapeError(s.floorShape) === null &&
      pillarGridError(s.pillarGrid) === null,
  },
]

/** The setup wizard: one full-page question per step, then into the planner. */
export function Wizard() {
  const setup = usePlanner((s) => s.wizard)
  const hasFloor = usePlanner((s) => s.floorplan !== null)
  const cancelSetup = usePlanner((s) => s.cancelSetup)
  const newFloorplan = usePlanner((s) => s.newFloorplan)
  const [step, setStep] = useState(0)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function createFloor() {
    const { floorName, floorShape, pillarGrid } = setup
    const outline = shapeOutline(floorShape)
    const bounds = { width: floorShape.width, depth: floorShape.depth, outline }
    const pillars = pillarGridPositions(bounds, pillarGrid).map((p) => ({
      ...p,
      width: pillarGrid.size,
      depth: pillarGrid.size,
    }))
    newFloorplan(
      {
        name: floorName.trim(),
        width: floorShape.width,
        depth: floorShape.depth,
        gridSize: DEFAULT_FLOORPLAN.gridSize,
        ...(outline && { outline }),
      },
      pillars,
    )
  }

  return (
    <StepLayout
      steps={STEPS.map((s) => s.label)}
      current={step}
      title={current.title}
      description={current.description}
      canNext={current.isValid(setup)}
      onNext={() => (isLast ? createFloor() : setStep(step + 1))}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      onCancel={hasFloor ? cancelSetup : undefined}
      nextLabel={isLast ? 'Create floor' : 'Next'}
    >
      {current.content}
    </StepLayout>
  )
}
