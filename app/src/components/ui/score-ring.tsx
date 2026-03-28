interface ScoreRingProps {
  score: number // 0-100
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  textColor?: string
  className?: string
}

export function ScoreRing({
  score,
  size = 100,
  strokeWidth = 8,
  color = '#06B6D4',
  trackColor = 'rgba(255,255,255,.15)',
  textColor = '#fff',
  className = '',
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="z-10 font-extrabold"
        style={{ fontSize: size * 0.32, color: textColor }}
      >
        {score}
      </span>
    </div>
  )
}
