import { useRef, useState } from 'react'
import { Check, ChevronDown, Columns2, Copy, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { downloadProject, parseProjectFile } from '@/lib/projectFile'
import { currentProject, usePlanner } from '@/store'

/**
 * The open project's name in the header, as a menu: switch between saved projects, and
 * duplicate, rename, delete or compare them. Keeps project handling out of the header itself.
 */
export function ProjectSwitcher({ onNewProject }: { onNewProject: () => void }) {
  const floorplan = usePlanner((s) => s.floorplan)
  const machineCount = usePlanner((s) => s.machines.length)
  const projects = usePlanner((s) => s.projects)
  const openProject = usePlanner((s) => s.openProject)
  const duplicateProject = usePlanner((s) => s.duplicateProject)
  const renameProject = usePlanner((s) => s.renameProject)
  const deleteProject = usePlanner((s) => s.deleteProject)
  const openCompare = usePlanner((s) => s.openCompare)
  const importProject = usePlanner((s) => s.importProject)
  const current = usePlanner(useShallow(currentProject))
  const fileInput = useRef<HTMLInputElement>(null)
  /** Why the last import failed, shown in the menu. */
  const [importError, setImportError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  /** Rename field showing (with its text), or null. */
  const [renaming, setRenaming] = useState<string | null>(null)
  /** Delete was clicked once and waits for the confirming click. */
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!floorplan) return null
  const others = [...projects].sort((a, b) => a.floorplan.name.localeCompare(b.floorplan.name))

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setRenaming(null)
      setConfirmDelete(false)
      setImportError(null)
    }
  }

  function commitRename() {
    const name = renaming?.trim()
    if (floorplan && name) renameProject(floorplan.id, name)
    setRenaming(null)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still fires
    if (!file) return
    const result = parseProjectFile(await file.text())
    if ('error' in result) return setImportError(result.error)
    importProject(result.project)
    onOpenChange(false)
  }

  /** Run an action and close the menu. */
  const then = (action: () => void) => () => {
    action()
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Project: ${floorplan.name}. Open projects menu`}
        >
          <span className="truncate">{floorplan.name}</span>
          <ChevronDown className="size-4 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-1.5">
        <div className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">Projects</div>
        <ul className="max-h-64 overflow-y-auto">
          {/* The open project first, ticked. */}
          <li>
            {renaming === null ? (
              <ProjectRow name={floorplan.name} detail={countText(machineCount)} current />
            ) : (
              <form
                className="px-1 py-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  commitRename()
                }}
              >
                <Input
                  autoFocus
                  aria-label="Project name"
                  value={renaming}
                  onChange={(e) => setRenaming(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setRenaming(null)
                    }
                  }}
                  className="h-8"
                />
              </form>
            )}
          </li>
          {others.map((p) => (
            <li key={p.floorplan.id}>
              <ProjectRow
                name={p.floorplan.name}
                detail={countText(p.machines.length)}
                onClick={then(() => openProject(p.floorplan.id))}
              />
            </li>
          ))}
        </ul>

        <Separator className="my-1.5" />

        <MenuItem icon={Plus} onClick={then(onNewProject)}>
          New project…
        </MenuItem>
        <MenuItem icon={Copy} onClick={then(duplicateProject)}>
          Duplicate
        </MenuItem>
        <MenuItem icon={Pencil} onClick={() => setRenaming(floorplan.name)}>
          Rename
        </MenuItem>
        <MenuItem icon={Columns2} disabled={projects.length === 0} onClick={then(openCompare)}>
          Compare…
          {projects.length === 0 && <span className="ml-auto text-xs text-muted-foreground">needs 2 projects</span>}
        </MenuItem>
        <Separator className="my-1.5" />
        <MenuItem icon={Download} disabled={!current} onClick={then(() => current && downloadProject(current))}>
          Export file
        </MenuItem>
        <MenuItem icon={Upload} onClick={() => fileInput.current?.click()}>
          Import file…
        </MenuItem>
        <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
        {importError && <p className="px-2 py-1.5 text-xs text-destructive">{importError}</p>}

        <Separator className="my-1.5" />
        {confirmDelete ? (
          <MenuItem icon={Trash2} destructive onClick={then(() => deleteProject(floorplan.id))}>
            Click again to delete “{floorplan.name}”
          </MenuItem>
        ) : (
          <MenuItem icon={Trash2} destructive onClick={() => setConfirmDelete(true)}>
            Delete
          </MenuItem>
        )}
      </PopoverContent>
    </Popover>
  )
}

const countText = (n: number) => `${n} ${n === 1 ? 'machine' : 'machines'}`

function ProjectRow({
  name,
  detail,
  current = false,
  onClick,
}: {
  name: string
  detail: string
  current?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={current}
      aria-current={current}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm enabled:hover:bg-muted"
    >
      <Check className={cn('size-4 shrink-0', !current && 'invisible')} />
      <span className={cn('min-w-0 flex-1 truncate', current && 'font-medium')}>{name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>
    </button>
  )
}

function MenuItem({
  icon: Icon,
  destructive = false,
  children,
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>
  destructive?: boolean
} & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm enabled:hover:bg-muted disabled:opacity-50',
        destructive && 'text-destructive',
      )}
      {...props}
    >
      <Icon className="size-4 shrink-0" />
      {children}
    </button>
  )
}
