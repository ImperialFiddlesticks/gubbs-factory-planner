type Priority = 'critical' | 'high' | 'medium' | 'low'

export interface SafetyReport {
  summary: string
  items: { priority: Priority; title: string; reason: string; action: string }[]
}

export interface SavedSafetyReport extends SafetyReport {
  id: string
  createdAt: string
  description: string
  location: string
  topPriority: Priority
  aiGenerated: boolean
}

const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:5116').replace(/\/$/, '')

async function request<T>(projectId: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/api/projects/${encodeURIComponent(projectId)}/safety-reports`, options)
  if (!response.ok) throw new Error(`Safety report request failed (${response.status})`)
  return response.json() as Promise<T>
}

export function createSafetyReport(projectId: string, observation: { description: string; detected: string[]; where: string }) {
  return request<SavedSafetyReport>(projectId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...observation, detected: observation.detected.slice(0, 20) }),
  })
}

export function listSafetyReports(projectId: string, signal: AbortSignal) {
  return request<SavedSafetyReport[]>(projectId, { signal })
}
