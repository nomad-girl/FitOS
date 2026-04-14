'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', icon: '\u{1F4CA}', label: 'Inicio' },
  { href: '/plan', icon: '\u{1F4CB}', label: 'Plan' },
  { href: '/progress', icon: '\u{1F4C8}', label: 'Progreso' },
  { href: '/journal', icon: '\u{1F4D3}', label: 'Diario' },
  { href: '/learn', icon: '\u{1F4DA}', label: 'Aprender' },
  { href: '/recovery', icon: '\u{1F504}', label: 'Recovery' },
]

export function BottomTabs() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div className="hidden max-md:block fixed bottom-0 left-0 right-0 bg-card border-t border-gray-100 z-[200] pb-[env(safe-area-inset-bottom,6px)] pt-1.5">
      <div className="flex justify-around">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-[3px] py-1.5 flex-1 text-[.65rem] font-medium no-underline transition-colors duration-200 ${
              isActive(tab.href) ? 'text-primary' : 'text-gray-400'
            }`}
          >
            <span className="text-[1.25rem]">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
