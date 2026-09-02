import React, { useState } from 'react'
import { InspectionDashboard } from './components/InspectionDashboard'
import { MetricsPanel }        from './components/MetricsPanel'
import { HistoryTable }         from './components/HistoryTable'
import { AuthModal }            from './components/AuthModal'
import { AuthProvider, useAuth } from './context/AuthContext'
import { InspectionProvider }    from './context/InspectionContext'
import { Activity, BarChart2, ClipboardList, LogIn, LogOut, User as UserIcon } from 'lucide-react'

const TABS = [
  { id: 'inspect', label: 'Live Inspection', icon: Activity },
  { id: 'metrics', label: 'Analytics',       icon: BarChart2 },
  { id: 'history', label: 'History',         icon: ClipboardList },
]

function AppHeader({ onOpenAuth }) {
  const { user, logout } = useAuth()

  return (
    <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              P
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">PomegranateAI</h1>
              <p className="text-xs text-gray-500">Automated Grading System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 bg-gray-800/60 px-3 py-1 rounded-full border border-gray-700/50">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-gray-300">System Online</span>
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-700">
                  <div className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center">
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs text-gray-200 font-medium hidden md:inline">{user.name}</span>
                </div>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                <LogIn size={15} />
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MainContent() {
  const [activeTab, setActiveTab] = useState('inspect')
  const [isAuthOpen, setIsAuthOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-950">
      <AppHeader onOpenAuth={() => setIsAuthOpen(true)} />

      {/* Tab navigation */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-red-500 text-red-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'inspect' && <InspectionDashboard />}
        {activeTab === 'metrics' && <MetricsPanel />}
        {activeTab === 'history' && <HistoryTable />}
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-600">
            PomegranateAI &mdash; Disease Screening &bull; Ripeness Grading &bull; Weight &amp; Quality Tiering
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <InspectionProvider>
        <MainContent />
      </InspectionProvider>
    </AuthProvider>
  )
}
