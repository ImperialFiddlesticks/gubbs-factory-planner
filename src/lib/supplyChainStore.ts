import { create } from 'zustand'
import { MATERIALS } from '@/lib/supplyChain'

/** Supply Chain Simulator state, separate from the planner store so the layout is never touched. */
interface SupplyChainState {
  open: boolean
  materialId: string
  delayDays: number
  useAlternative: boolean
  setOpen: (open: boolean) => void
  setMaterial: (id: string) => void
  setDelay: (days: number) => void
  setUseAlternative: (on: boolean) => void
  reset: () => void
}

export const useSupplyChain = create<SupplyChainState>((set) => ({
  open: false,
  materialId: MATERIALS[0]!.id,
  delayDays: 0,
  useAlternative: false,
  setOpen: (open) => set({ open }),
  setMaterial: (materialId) => set({ materialId, delayDays: 0, useAlternative: false }),
  setDelay: (delayDays) => set({ delayDays }),
  setUseAlternative: (useAlternative) => set({ useAlternative }),
  reset: () => set({ delayDays: 0, useAlternative: false }),
}))
