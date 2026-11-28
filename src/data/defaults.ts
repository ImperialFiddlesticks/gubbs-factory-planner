import type { Floorplan } from '@/types'

export const DEFAULT_FACTORY_HEIGHT_MM = 6000

export const DEFAULT_FLOORPLAN: Floorplan = {
  id: 'default',
  name: 'New factory',
  width: 30000, // 30 m
  depth: 20000, // 20 m
  height: DEFAULT_FACTORY_HEIGHT_MM,
  gridSize: 500,
}
