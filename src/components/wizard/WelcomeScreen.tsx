import { ArrowRight, Factory, LayoutGrid, Ruler, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePlanner } from '@/store'

const HIGHLIGHTS = [
  { icon: Ruler, title: 'Shape your floor', text: 'Set the size and shape of the hall you are planning.' },
  { icon: LayoutGrid, title: 'Place equipment', text: 'Drag machines and utilities onto the floor and rotate them.' },
  { icon: TriangleAlert, title: 'Check the layout', text: 'See clashes, missing clearance and utility gaps as you go.' },
]

/** First screen: what the tool is, and a way in. */
export function WelcomeScreen() {
  const startSetup = usePlanner((s) => s.startSetup)
  const openExample = usePlanner((s) => s.openExample)

  return (
    <div className="theme-chrome flex h-screen flex-col">
      <header className="relative z-10 flex h-14 items-center gap-3 border-b bg-card px-4 shadow-soft">
        <span className="h-6 w-1 bg-accent" aria-hidden />
        <span className="text-sm font-semibold tracking-widest uppercase">Factory Planner</span>
      </header>

      <main className="flex flex-1 items-center overflow-y-auto">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-widest text-(--amber-text) uppercase">
              Production layout planning
            </p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold lg:text-5xl">
              Plan your factory floor, one step at a time.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Answer a few questions about what you want to plan, then lay out machines on a 2D
              floor and see straight away what fits and what doesn't.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-(--saab-yellow-dark)"
                onClick={startSetup}
                autoFocus
              >
                Start planning <ArrowRight />
              </Button>
              <Button size="lg" variant="outline" onClick={openExample}>
                <Factory /> Open an example workshop
              </Button>
            </div>

            <ul className="mt-12 grid gap-6 sm:grid-cols-3">
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Icon className="size-5 text-primary" aria-hidden />
                  <h2 className="mt-2 text-sm font-semibold">{title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>

          <FloorIllustration />
        </div>
      </main>
    </div>
  )
}

/** A small decorative top-view layout: floor, machines with dashed clearance, one clash. */
function FloorIllustration() {
  return (
    <svg viewBox="0 0 400 280" className="hidden w-full lg:block" aria-hidden>
      <rect x="10" y="10" width="380" height="260" rx="16" fill="var(--saab-white)" stroke="var(--warm-300)" strokeWidth="2" />
      <g stroke="var(--saab-grey-200)" strokeWidth="1">
        {Array.from({ length: 18 }, (_, i) => (
          <line key={`v${i}`} x1={30 + i * 20} y1="10" x2={30 + i * 20} y2="270" />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`h${i}`} x1="10" y1={30 + i * 20} x2="390" y2={30 + i * 20} />
        ))}
      </g>
      <g fill="none" stroke="var(--saab-grey-500)" strokeDasharray="4 3">
        <rect x="40" y="40" width="110" height="90" />
        <rect x="190" y="40" width="90" height="80" />
        <rect x="60" y="170" width="170" height="70" />
      </g>
      <g fill="var(--saab-blue)" stroke="var(--saab-blue-dark)">
        <rect x="60" y="55" width="70" height="60" rx="2" />
        <rect x="205" y="55" width="60" height="50" rx="2" />
        <rect x="75" y="185" width="140" height="40" rx="2" />
      </g>
      {/* A machine pushed into its neighbour's clearance: the clash is highlighted. */}
      <rect x="265" y="105" width="15" height="15" fill="var(--saab-red)" opacity="0.3" />
      <rect x="265" y="105" width="90" height="70" rx="2" fill="var(--saab-blue)" stroke="var(--saab-red)" strokeWidth="2.5" />
      <rect x="290" y="210" width="70" height="40" rx="2" fill="var(--saab-yellow)" stroke="var(--saab-yellow-dark)" />
    </svg>
  )
}
