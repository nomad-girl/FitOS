'use client'

import { useState } from 'react'

interface RatingGroupProps {
  value?: number
  onChange?: (value: number) => void
  max?: number
  className?: string
}

export function RatingGroup({ value, onChange, max = 5, className = '' }: RatingGroupProps) {
  const [selected, setSelected] = useState<number | undefined>(value)

  function handleClick(n: number) {
    setSelected(n)
    onChange?.(n)
  }

  return (
    <div className={`flex gap-1.5 ${className}`}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => handleClick(n)}
          className={`w-11 h-11 rounded-[var(--radius-sm)] border-[1.5px] font-semibold text-[.92rem] flex items-center justify-center transition-all duration-200 cursor-pointer ${
            selected === n
              ? 'bg-primary text-white border-primary'
              : 'border-gray-200 text-gray-500 hover:border-primary hover:text-primary'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
