import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createSafetyReport, type SavedSafetyReport } from '@/lib/safetyReportApi'

const COLOURS: Record<SavedSafetyReport['items'][number]['priority'], string> = {
  critical: 'bg-rose-600', high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-emerald-500',
}

export function SafetyReportPanel({ projectId, detected, where }: { projectId: string; detected: string[]; where: string }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<SavedSafetyReport | null>(null)

  async function submit() {
    setBusy(true); setError(null); setReport(null)
    try {
      const res = await createSafetyReport(projectId, { description: text, detected, where })
      setReport(res)
    } catch { setError('Could not create the report. Try again.') }
    finally { setBusy(false) }
  }

  return (
    <section className="mt-5 border-t pt-4">
      <h2 className="mb-2 text-sm font-semibold">Report a risk</h2>
      <label className="block text-xs text-muted-foreground">
        Describe what you see
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000}
          placeholder="e.g. Forklifts come fast around the welding cell and I can't see them"
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" />
      </label>
      <Button size="sm" className="mt-2 w-full" disabled={busy || text.trim().length < 5} onClick={submit}>
        {busy ? 'Creating report…' : 'Create safety report'}
      </Button>
      {error && <p role="alert" className="mt-2 text-xs text-rose-500">{error}</p>}
      {report && (
        <div className="mt-3 space-y-2" aria-label="Safety report">
          <p className="text-xs">{report.summary}</p>
          <ol className="space-y-2">
            {report.items.map((item, i) => (
              <li key={i} className="rounded-md border p-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <span className={'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ' + COLOURS[item.priority]}>{item.priority}</span>
                  <span className="font-semibold">{item.title}</span>
                </div>
                <p className="text-muted-foreground">{item.reason}</p>
                <p className="mt-1"><span className="font-semibold">Action: </span>{item.action}</p>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground">Saved to Safety reports. {report.aiGenerated ? "AI-generated draft" : "Observation with planner findings"} for review.</p>
        </div>
      )}
    </section>
  )
}
