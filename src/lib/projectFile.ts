import { getMachineType } from '@/data/catalog'
import { ProjectSchema } from '@/lib/autosave'
import { DEFAULT_SETUP, type Project } from '@/store'

/**
 * Project files: a project saved as JSON, to share by e-mail or a shared drive until the
 * backend can sync plans. Checked with the same schema as autosave when read back.
 */

const FORMAT = 'gubbs-factory-project'
const VERSION = 1

/** Download the project as "<name>.factory.json". */
export function downloadProject(project: Project) {
  const file = { format: FORMAT, version: VERSION, project }
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // Characters that aren't allowed in file names on Windows or macOS.
  a.download = `${project.floorplan.name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'project'}.factory.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Read a project file: the project, or a short message saying what's wrong with the file. */
export function parseProjectFile(text: string): { project: Project } | { error: string } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { error: 'This file isn’t a project file (it isn’t valid JSON).' }
  }
  const wrapper = json as { format?: unknown; version?: unknown; project?: unknown } | null
  if (wrapper?.format !== FORMAT) return { error: 'This file isn’t a Factory Planner project.' }
  if (wrapper.version !== VERSION) return { error: 'This project file is from a different version of the planner.' }
  const parsed = ProjectSchema.safeParse(wrapper.project)
  if (!parsed.success) return { error: 'This project file is damaged or incomplete.' }
  const p = parsed.data
  return {
    project: {
      ...p,
      // Machines whose type isn't in this catalog are left out.
      machines: p.machines.filter((m) => getMachineType(m.typeId)),
      setup: { ...DEFAULT_SETUP, ...p.setup },
    },
  }
}
