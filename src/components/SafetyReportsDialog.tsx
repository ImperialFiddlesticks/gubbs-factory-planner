import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listSafetyReports, type SavedSafetyReport } from '@/lib/safetyReportApi'

const COLOURS: Record<SavedSafetyReport['topPriority'], string> = {
  critical: 'bg-rose-600', high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-emerald-500',
}
const ORDER = ['critical', 'high', 'medium', 'low'] as const

export function SafetyReportsDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reports, setReports] = useState<SavedSafetyReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    listSafetyReports(projectId, controller.signal).then(setReports).catch(() => {
      if (!controller.signal.aborted) setError('Could not load the reports.')
    })
    return () => controller.abort()
  }, [open, projectId])

  const sorted = reports ? [...reports].sort((a, b) => ORDER.indexOf(a.topPriority) - ORDER.indexOf(b.topPriority)) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5" /> Safety reports</DialogTitle>
          <DialogDescription>Risks workers reported in Worker view, most urgent first. Drafts for the safety officer to review.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
        {!sorted && !error && <p className="text-sm text-muted-foreground">Loading reports…</p>}
        {sorted?.length === 0 && <p className="text-sm text-muted-foreground">No reports yet. Workers can report a risk in 3D & simulation → Worker view.</p>}
        <ul className="space-y-2" aria-label="Report list">
          {sorted?.map((r) => (
            <li key={r.id} className="rounded-md border">
              <button type="button" className="flex w-full items-start gap-2 p-3 text-left" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                <span className={'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ' + COLOURS[r.topPriority]}>{r.topPriority}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.items[0]?.title ?? r.summary}</span>
                  <span className="block text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()} · {r.location}</span>
                </span>
              </button>
              {openId === r.id && (
                <div className="space-y-2 border-t p-3 text-xs">
                  <p><span className="font-semibold">Worker said: </span>{r.description}</p>
                  <p>{r.summary}</p>
                  <p className="text-muted-foreground">{r.aiGenerated ? "AI-generated draft" : "Observation with planner findings"}</p>
                  <ol className="space-y-2">
                    {r.items.map((item, i) => (
                      <li key={i} className="rounded border p-2">
                        <span className={'mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ' + COLOURS[item.priority]}>{item.priority}</span>
                        <span className="font-semibold">{item.title}</span>
                        <p className="mt-1 text-muted-foreground">{item.reason}</p>
                        <p className="mt-1"><span className="font-semibold">Action: </span>{item.action}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
