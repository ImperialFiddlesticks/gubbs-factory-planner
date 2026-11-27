import type { Project } from '@/store'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5116')
    .replace(/\/$/, '')

const PROJECTS_URL = `${API_BASE_URL}/api/projects`

export interface SavedProjectResponse {
    id: string
    createdAt: string
    updatedAt: string
    project: Project
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${PROJECTS_URL}${path}`, {
        ...init,
        headers: {
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
            ...init?.headers,
        },
    })

    if (!response.ok) {
        const details = await response.text()
        throw new Error(details || `Project API request failed (${response.status})`)
    }

    if (response.status === 204) {
        return undefined as T
    }

    return (await response.json()) as T
}

export function listProjectsFromServer(): Promise<SavedProjectResponse[]> {
    return request<SavedProjectResponse[]>('')
}

export function getProjectFromServer(id: string): Promise<SavedProjectResponse> {
    return request<SavedProjectResponse>(`/${encodeURIComponent(id)}`)
}

export function createProjectOnServer(project: Project): Promise<SavedProjectResponse> {
    return request<SavedProjectResponse>('', {
        method: 'POST',
        body: JSON.stringify(project),
    })
}

export function updateProjectOnServer(project: Project): Promise<SavedProjectResponse> {
    const id = encodeURIComponent(project.floorplan.id)

    return request<SavedProjectResponse>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(project),
    })
}

export function deleteProjectOnServer(id: string): Promise<void> {
    return request<void>(`/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    })
}