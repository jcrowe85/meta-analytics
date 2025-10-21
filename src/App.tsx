import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { Navigation } from './components/Navigation'
import { Campaigns } from './pages/Campaigns'
import { LiveAds } from './pages/LiveAds'
import { Overview } from './pages/Overview'

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <BrowserRouter>
      <div className="min-h-screen md:flex">
        <Navigation sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />
        <main className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64 lg:ml-72'}
          ml-0
        `}>
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/live" element={<LiveAds />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
