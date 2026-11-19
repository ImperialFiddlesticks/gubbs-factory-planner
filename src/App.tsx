import { CatalogPanel } from '@/components/CatalogPanel'
import { FloorCanvas } from '@/components/FloorCanvas'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { TopBar } from '@/components/TopBar'
import { DEFAULT_FLOORPLAN } from '@/data/defaults'

function App() {
  // Static until the store (step 4) is in place.
  const floorplan = DEFAULT_FLOORPLAN

  return (
    <div className="grid h-screen grid-cols-[256px_1fr_288px] grid-rows-[56px_1fr]">
      <TopBar floorplan={floorplan} />
      <CatalogPanel />
      <FloorCanvas floorplan={floorplan} />
      <PropertiesPanel />
    </div>
  )
}

export default App
