import { useState } from 'react'
import { CatalogPanel } from '@/components/CatalogPanel'
import { ComparePage } from '@/components/compare/ComparePage'
import { FloorCanvas } from '@/components/FloorCanvas'
import { GuidedTour } from '@/components/GuidedTour'
import { QuickGuide } from '@/components/QuickGuide'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { SimulationView } from '@/components/SimulationView'
import { TopBar } from '@/components/TopBar'
import { WelcomeScreen } from '@/components/wizard/WelcomeScreen'
import { Wizard } from '@/components/wizard/Wizard'
import { usePlanner } from '@/store'
const QUICK_GUIDE_SEEN_KEY = 'gubbs-factory-planner:quick-guide-seen-v2'

function App() {
  const screen = usePlanner((s) => s.screen)
  const [guideSeen, setGuideSeen] = useState(() => localStorage.getItem(QUICK_GUIDE_SEEN_KEY) === 'true')
  const [guideRequested, setGuideRequested] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [tourStep, setTourStep] = useState(0)

  // Show the first-visit guide as soon as a new floor reaches the planner.
  const guideOpen = screen === 'planner' && (guideRequested || !guideSeen)

  function handleGuideOpenChange(open: boolean) {
    setGuideRequested(open)
    if (!open) {
      localStorage.setItem(QUICK_GUIDE_SEEN_KEY, 'true')
      setGuideSeen(true)
    }
  }

  function startGuidedTour() {
    localStorage.setItem(QUICK_GUIDE_SEEN_KEY, 'true')
    setGuideSeen(true)
    setGuideRequested(false)
    setTourStep(0)
    setTourActive(true)
  }

  function closeGuidedTour() {
    setTourActive(false)
    localStorage.setItem(QUICK_GUIDE_SEEN_KEY, 'true')
    setGuideSeen(true)
  }

  return (
    <>
      {screen === 'welcome' ? <WelcomeScreen />
        : screen === 'wizard' ? <Wizard onCreated={() => setGuideRequested(true)} />
          : screen === 'compare' ? <ComparePage />
            : <Planner onOpenHelp={() => setGuideRequested(true)} />}
      <QuickGuide open={guideOpen} onOpenChange={handleGuideOpenChange} onStartTour={startGuidedTour} />
      {tourActive && screen === 'planner' && (
        <GuidedTour stepIndex={tourStep} onStepChange={setTourStep} onClose={closeGuidedTour} />
      )}
    </>
  )
}

function Planner({ onOpenHelp }: { onOpenHelp: () => void }) {
  const floorplan = usePlanner((s) => s.floorplan)
  const startSetup = usePlanner((s) => s.startSetup)

  const [simulationOpen, setSimulationOpen] = useState(false)
  const [catalogCollapsed, setCatalogCollapsed] = useState(false)
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false)
  const [factoryPropertiesOpen, setFactoryPropertiesOpen] = useState(false)

  return (
    <div className={`planner-shell${catalogCollapsed ? ' catalog-collapsed' : ''}${propertiesCollapsed ? ' properties-collapsed' : ''}`}>

      <TopBar
        onNewFloor={startSetup}
        onOpenFactoryProperties={() => setFactoryPropertiesOpen(true)}
        onOpenHelp={() => {
          setCatalogCollapsed(false)
          setPropertiesCollapsed(false)
          onOpenHelp()
        }}
        onOpenSimulation={() => setSimulationOpen(true)}
      />

      <CatalogPanel
        collapsed={catalogCollapsed}
        onToggle={() => setCatalogCollapsed((collapsed) => !collapsed)}
      />

      <FloorCanvas
        floorplan={floorplan}
      />

      {simulationOpen && floorplan && (
        <SimulationView
          floor={floorplan}
          onClose={() => setSimulationOpen(false)}
        />
      )}

      <PropertiesPanel
        showFactoryProperties={factoryPropertiesOpen}
        collapsed={propertiesCollapsed}
        onToggle={() => setPropertiesCollapsed((collapsed) => !collapsed)}
      />

    </div>
  )
}

export default App
