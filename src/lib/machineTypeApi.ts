import type { CatalogMachine } from '@/data/catalog'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5116').replace(/\/$/, '')

export async function listMachineTypesFromServer(): Promise<CatalogMachine[]> {
  const response = await fetch(`${API_BASE_URL}/api/MachineTypes`)

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || `Machine types request failed (${response.status})`)
  }

  return (await response.json()) as CatalogMachine[]
}
