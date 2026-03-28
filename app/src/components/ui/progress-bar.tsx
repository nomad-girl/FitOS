type FillVariant = 'blue' | 'green' | 'yellow' | 'red' | 'white'

const fillClasses: Record<FillVariant, string> = {
  blue: 'bg-gradient-to-r from-primary to-accent',
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-danger',
  white: 'bg-white',
}

interface ProgressBarProps {
  value: number // 0-100
  variant?: FillVariant
  height?: string
  trackColor?: string
  className?: string
}

export function ProgressBar({
  value,
  variant = 'blue',
  height = '6px',
  trackColor,
  className = '',
}: ProgressBarProps) {
  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ height, background: trackColor || undefined }}
    >
      <div
        className={`h-full rounded-lg transition-[width] duration-600 ease-out ${
          !trackColor ? 'bg-gray-100' : ''
        }`}
        style={{ height, background: trackColor || undefined }}
      >
        <div
          className={`h-full rounded-lg ${fillClasses[variant]}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}
