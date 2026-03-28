interface RightPanelProps {
  children: React.ReactNode
  className?: string
}

export function RightPanel({ children, className = '' }: RightPanelProps) {
  return (
    <aside
      className={`w-[var(--panel-w)] min-w-[var(--panel-w)] bg-card border-l border-gray-100 py-8 px-6 sticky top-0 h-screen overflow-y-auto hidden lg:block ${className}`}
    >
      {children}
    </aside>
  )
}
