import { useEffect, useRef, useState } from 'react'
import { CatalogPanel } from '@/components/CatalogPanel'
import { ComparePage } from '@/components/compare/ComparePage'
import { FloorCanvas } from '@/components/FloorCanvas'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { TopBar } from '@/components/TopBar'
import { WelcomeScreen } from '@/components/wizard/WelcomeScreen'
import { Wizard } from '@/components/wizard/Wizard'
import { usePlanner } from '@/store'
import type { MachineInstance } from '@/types'

type OnboardingStage = 'equipment' | 'machine-tip' | null

const ONBOARDING_SEEN_KEY = 'gubbs-factory-planner:onboarding-seen'

function App() {
  const screen = usePlanner((s) => s.screen)

  if (screen === 'welcome') return <WelcomeScreen />
  if (screen === 'wizard') return <Wizard />
  if (screen === 'compare') return <ComparePage />
  return <Planner />
}

function Planner() {
  const floorplan = usePlanner((s) => s.floorplan)
  const machines = usePlanner((s) => s.machines)
  const selectedIds = usePlanner((s) => s.selectedIds)
  const startSetup = usePlanner((s) => s.startSetup)
  const [catalogCollapsed, setCatalogCollapsed] = useState(false)
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false)
  const [factoryPropertiesOpen, setFactoryPropertiesOpen] = useState(false)
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>(() =>
    localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true' || !floorplan || machines.length > 0
      ? null
      : 'equipment',
  )
  const activeOnboardingStage =
    onboardingStage === 'equipment' && machines.length > 0 ? 'machine-tip' : onboardingStage
  const onboardingBaseline = useRef<{ machine: MachineInstance; selectedIds: string[] } | null>(null)

  useEffect(() => {
    if (onboardingStage === 'equipment' && localStorage.getItem(ONBOARDING_SEEN_KEY) !== 'true') {
      localStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
    }
  }, [onboardingStage])

  useEffect(() => {
    if (onboardingStage !== 'equipment' || machines.length === 0 || onboardingBaseline.current) return
    onboardingBaseline.current = { machine: machines[0], selectedIds }
  }, [onboardingStage, machines, selectedIds])

  useEffect(() => {
    if (activeOnboardingStage !== 'machine-tip' || !onboardingBaseline.current) return
    const baseline = onboardingBaseline.current
    const machine = machines.find((item) => item.id === baseline.machine.id)
    const selectedMachine = selectedIds.some((id) => machines.some((item) => item.id === id))
    if (!machine || machine !== baseline.machine || (selectedIds !== baseline.selectedIds && selectedMachine)) {
      onboardingBaseline.current = null
      setOnboardingStage(null)
    }
  }, [activeOnboardingStage, machines, selectedIds])

  function openHelp() {
    setCatalogCollapsed(false)
    if (machines.length === 0) {
      onboardingBaseline.current = null
      setOnboardingStage('equipment')
      return
    }

    const machine = machines.find((item) => selectedIds.includes(item.id)) ?? machines[0]
    onboardingBaseline.current = { machine, selectedIds }
    setOnboardingStage('machine-tip')
  }

  function skipOnboarding() {
    onboardingBaseline.current = null
    setOnboardingStage(null)
  }

  const onboardingMessage =
    activeOnboardingStage === 'equipment'
      ? 'Time to create your factory. Start by adding equipment from the left sidebar.'
      : activeOnboardingStage === 'machine-tip'
        ? 'Try dragging equipment onto the floor. Select a machine to edit its properties.'
        : null

  return (
    <div className={`planner-shell${catalogCollapsed ? ' catalog-collapsed' : ''}${propertiesCollapsed ? ' properties-collapsed' : ''}`}>
      <TopBar
        onNewFloor={startSetup}
        onOpenFactoryProperties={() => setFactoryPropertiesOpen(true)}
        onOpenHelp={openHelp}
      />
      <CatalogPanel
        collapsed={catalogCollapsed}
        highlighted={activeOnboardingStage === 'equipment'}
        onToggle={() => setCatalogCollapsed((collapsed) => !collapsed)}
      />
      <FloorCanvas
        floorplan={floorplan}
        onboardingMessage={onboardingMessage}
        onSkipOnboarding={skipOnboarding}
      />
      <PropertiesPanel
        showFactoryProperties={factoryPropertiesOpen}
        collapsed={propertiesCollapsed}
        onToggle={() => setPropertiesCollapsed((collapsed) => !collapsed)}
      />
    </div>
  )
}

export default App
