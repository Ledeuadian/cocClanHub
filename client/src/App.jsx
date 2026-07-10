import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import OnboardingGate from './components/OnboardingGate.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Members from './pages/Members.jsx'
import Chat from './pages/Chat.jsx'
import Wars from './pages/Wars.jsx'
import CWLPlanner from './pages/CWLPlanner.jsx'
import Bases from './pages/Bases.jsx'
import Strategies from './pages/Strategies.jsx'
import Announcements from './pages/Announcements.jsx'
import Calendar from './pages/Calendar.jsx'
import Profile from './pages/Profile.jsx'
import Login from './pages/Login.jsx'
import Settings from './pages/Settings.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      {/* Auth route (no layout, no protection) */}
      <Route path="/login" element={<Login />} />

      {/* App routes (protected + onboarding gate) */}
      <Route
        element={
          <ProtectedRoute>
            <OnboardingGate>
              <AppLayout />
            </OnboardingGate>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/members" element={<Members />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/wars" element={<Wars />} />
        <Route path="/cwl" element={<CWLPlanner />} />
        <Route path="/bases" element={<Bases />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
