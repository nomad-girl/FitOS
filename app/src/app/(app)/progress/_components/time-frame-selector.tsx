'use client'

const PERIODS = ['1S', '2S', '1M', '3M', '6M', '1A', 'Todo'] as const

interface Props {
  selected: string
  onChange: (period: string) => void
}

const labels: Record<string, string> = {
  '1S': '1 Sem',
  '2S': '2 Sem',
  '1M': '1 Mes',
  '3M': '3 Mes',
  '6M': '6 Mes',
  '1A': '1 Ano',
  'Todo': 'Todo',
}

export function TimeFrameSelector({ selected, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
      {PERIODS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="text-[.76rem] font-bold px-3 py-1.5 rounded-full border cursor-pointer transition-all whitespace-nowrap"
          style={{
            borderColor: selected === p ? 'var(--primary)' : '#E5E7EB',
            backgroundColor: selected === p ? 'var(--primary)' : 'transparent',
            color: selected === p ? 'white' : '#6B7280',
          }}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  )
}
