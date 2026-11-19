import { useState } from 'react'
import { CatalogPanel } from '@/components/CatalogPanel'
import { FloorCanvas } from '@/components/FloorCanvas'
import { NewFloorDialog } from '@/components/NewFloorDialog'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { TopBar } from '@/components/TopBar'
import { usePlanner } from '@/store'

function App() {
  const floorplan = usePlanner((s) => s.floorplan)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="grid h-screen grid-cols-[256px_1fr_288px] grid-rows-[56px_1fr]">
      <TopBar onNewFloor={() => setDialogOpen(true)} />
      <CatalogPanel />
      <FloorCanvas floorplan={floorplan} />
      <PropertiesPanel />

      {/* Forced open until the first floor exists. Remounted on each open so
          the form starts from the defaults. */}
      {(dialogOpen || !floorplan) && (
        <NewFloorDialog
          open
          required={!floorplan}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  )
}

export default App
