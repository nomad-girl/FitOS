'use client'

interface Props {
  sessions: { session_date: string }[]
  from: string
  to: string
}

export function AdherenceHeatmap({ sessions, from, to }: Props) {
  // Build set of training dates
  const trainingDates = new Set(sessions.map(s => s.session_date))

  // Generate all dates in range
  const start = new Date(from + 'T12:00:00')
  const end = new Date(to + 'T12:00:00')
  const days: { date: string; dayOfWeek: number; trained: boolean }[] = []

  const current = new Date(start)
  while (current <= end) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
    days.push({
      date: dateStr,
      dayOfWeek: current.getDay(),
      trained: trainingDates.has(dateStr),
    })
    current.setDate(current.getDate() + 1)
  }

  if (days.length === 0) return null

  // Group into weeks
  const weeks: typeof days[] = []
  let currentWeek: typeof days = []

  // Pad first week
  if (days[0].dayOfWeek > 0) {
    for (let i = 0; i < days[0].dayOfWeek; i++) {
      currentWeek.push({ date: '', dayOfWeek: i, trained: false })
    }
  }

  for (const day of days) {
    if (day.dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)
  }
  if (currentWeek.length > 0) weeks.push(currentWeek)

  const cellSize = 14
  const gap = 2
  const dayLabels = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

  const totalTrained = sessions.length
  const totalDays = days.filter(d => d.date).length
  const percentage = totalDays > 0 ? Math.round((totalTrained / totalDays) * 100) : 0

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[1.3rem] font-extrabold text-gray-800">{totalTrained}</span>
        <span className="text-[.84rem] text-gray-400">sesiones en {totalDays} dias ({percentage}%)</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-0.5" style={{ minWidth: `${weeks.length * (cellSize + gap)}px` }}>
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1">
            {dayLabels.map((l, i) => (
              <div key={i} className="text-[8px] text-gray-400 font-semibold flex items-center justify-end" style={{ height: cellSize, width: 12 }}>
                {i % 2 === 1 ? l : ''}
              </div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {Array.from({ length: 7 }, (_, di) => {
                const day = week.find(d => d.dayOfWeek === di)
                const isEmpty = !day || !day.date
                const today = new Date()
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                const isToday = day?.date === todayStr
                return (
                  <div
                    key={di}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 3,
                      backgroundColor: isEmpty ? 'transparent' : day.trained ? '#F97316' : '#F3F4F6',
                      opacity: isEmpty ? 0 : day.trained ? 1 : 0.6,
                      border: isToday ? '2px solid #374151' : 'none',
                    }}
                    title={day?.date ? `${day.date}${day.trained ? ' - Entreno' : ''}` : ''}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[.7rem] text-gray-400">
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#F3F4F6' }} /> Descanso</div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#F97316' }} /> Entreno</div>
      </div>
    </div>
  )
}
