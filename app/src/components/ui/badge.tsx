type BadgeVariant = 'blue' | 'green' | 'yellow' | 'gray' | 'red'

const variantClasses: Record<BadgeVariant, string> = {
  blue: 'bg-primary-light text-primary-dark',
  green: 'bg-success-light text-[#065F46]',
  yellow: 'bg-warning-light text-[#92400E]',
  red: 'bg-danger-light text-[#991B1B]',
  gray: 'bg-gray-100 text-gray-600',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'blue', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex px-2.5 py-[3px] rounded-full text-[.73rem] font-semibold tracking-[.01em] ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
