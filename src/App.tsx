import { CatalogPanel } from '@/components/CatalogPanel'
import { FloorCanvas } from '@/components/FloorCanvas'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { TopBar } from '@/components/TopBar'
import { WelcomeScreen } from '@/components/wizard/WelcomeScreen'
import { Wizard } from '@/components/wizard/Wizard'
import { usePlanner } from '@/store'

function App() {
  const screen = usePlanner((s) => s.screen)

  if (screen === 'welcome') return <WelcomeScreen />
  if (screen === 'wizard') return <Wizard />
  return <Planner />
}

function Planner() {
  const floorplan = usePlanner((s) => s.floorplan)
  const startSetup = usePlanner((s) => s.startSetup)

  return (
    <div className="grid h-screen grid-cols-[256px_1fr_288px] grid-rows-[56px_1fr]">
      <TopBar onNewFloor={startSetup} />
      <CatalogPanel />
      <FloorCanvas floorplan={floorplan} />
      <PropertiesPanel />
    </div>
  )
}

export default App
