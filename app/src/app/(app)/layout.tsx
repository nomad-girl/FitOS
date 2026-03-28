'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { BottomTabs } from '@/components/layout/bottom-tabs'
import { QuickLogDrawer } from '@/components/shared/quick-log-drawer'
import { ProfileModal } from '@/components/shared/profile-modal'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [quickLogOpen, setQuickLogOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <Sidebar onProfileClick={() => setProfileOpen(true)} />

      {/* Main Area */}
      <div className="flex-1 ml-[var(--sidebar-w)] flex min-h-screen max-md:ml-0">
        {children}
      </div>

      {/* FAB Button */}
      <button
        onClick={() => setQuickLogOpen(true)}
        className="fixed bottom-7 right-7 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent text-white text-2xl flex items-center justify-center shadow-[0_4px_16px_rgba(14,165,233,.35),0_2px_6px_rgba(0,0,0,.1)] cursor-pointer border-none z-[250] transition-all duration-250 hover:scale-[1.08] hover:shadow-[0_6px_24px_rgba(14,165,233,.45),0_2px_8px_rgba(0,0,0,.12)] active:scale-95 max-md:bottom-20 max-md:right-4"
      >
        +
      </button>

      {/* Mobile Bottom Tabs */}
      <BottomTabs />

      {/* Quick Log Drawer */}
      <QuickLogDrawer open={quickLogOpen} onClose={() => setQuickLogOpen(false)} />

      {/* Profile Modal */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
