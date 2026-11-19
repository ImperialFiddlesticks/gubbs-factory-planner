import { DoorOpen, Droplet, ShowerHead, Zap, type LucideIcon } from 'lucide-react'
import type { UtilityKind } from '@/types'

/** HTML icons for each utility kind (the canvas draws the same lucide shapes). */
export const UTILITY_ICONS: Record<UtilityKind, LucideIcon> = {
  power: Zap,
  water: Droplet,
  sprinkler: ShowerHead,
  exit: DoorOpen,
}
