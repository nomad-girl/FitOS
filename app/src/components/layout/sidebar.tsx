'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', icon: '\u{1F4CA}', label: 'Inicio' },
  { href: '/plan', icon: '\u{1F4CB}', label: 'Plan' },
  { href: '/progress', icon: '\u{1F4C8}', label: 'Progreso' },
  { href: '/journal', icon: '\u{1F4D3}', label: 'Diario' },
  { href: '/learn', icon: '\u{1F4DA}', label: 'Aprender' },
]

interface SidebarProps {
  onProfileClick?: () => void
}

export function Sidebar({ onProfileClick }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-[var(--sidebar-w)] bg-card border-r border-gray-100 flex flex-col fixed top-0 left-0 bottom-0 z-[100] transition-transform duration-300 max-md:-translate-x-full">
      {/* Logo */}
      <div className="pt-7 pb-5 px-6 font-extrabold text-[1.35rem] text-primary-dark tracking-tight">
        Fit<span className="text-accent">OS</span>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 mx-4" />

      {/* Navigation */}
      <nav className="flex-1 p-3 px-2.5 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 py-[11px] px-4 rounded-[var(--radius-sm)] font-medium text-[.92rem] transition-all duration-200 no-underline ${
              isActive(item.href)
                ? 'bg-primary-light text-primary-dark font-semibold'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <span className="text-[1.1rem] w-[22px] text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Divider */}
      <div className="h-px bg-gray-100 mx-4" />

      {/* User */}
      <div onClick={onProfileClick} className="p-4 border-t border-gray-100 flex items-center gap-3 cursor-pointer transition-colors duration-200 hover:bg-gray-50">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-[.85rem]">
          N
        </div>
        <div className="flex-1">
          <div className="font-semibold text-[.88rem] text-gray-800">Natali</div>
          <div className="text-[.75rem] text-gray-400">Entrenando desde 2024</div>
        </div>
      </div>
    </aside>
  )
}
