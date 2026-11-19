export function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
      {children}
    </h2>
  )
}
