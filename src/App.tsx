import { useState } from 'react'
import { CatalogPanel } from '@/components/CatalogPanel'
import { ComparePage } from '@/components/compare/ComparePage'
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
  if (screen === 'compare') return <ComparePage />
  return <Planner />
}

function Planner() {
  const floorplan = usePlanner((s) => s.floorplan)
  const startSetup = usePlanner((s) => s.startSetup)
  const [catalogCollapsed, setCatalogCollapsed] = useState(false)

  return (
    <div
      className="grid h-screen grid-rows-[56px_1fr]"
      style={{ gridTemplateColumns: `${catalogCollapsed ? 48 : 256}px minmax(0, 1fr) 288px` }}
    >
      <TopBar onNewFloor={startSetup} />
      <CatalogPanel collapsed={catalogCollapsed} onToggle={() => setCatalogCollapsed((collapsed) => !collapsed)} />
      <FloorCanvas floorplan={floorplan} />
      <PropertiesPanel />
    </div>
  )
}

export default App
