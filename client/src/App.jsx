import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import OnboardingGate from './components/OnboardingGate.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
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

      {/* App routes (protected + onboarding gate + error safety) */}
      <Route
        element={
          <ProtectedRoute>
            <OnboardingGate>
              <AppLayout />
            </OnboardingGate>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="/members" element={<ErrorBoundary><Members /></ErrorBoundary>} />
        <Route path="/chat" element={<ErrorBoundary><Chat /></ErrorBoundary>} />
        <Route path="/wars" element={<ErrorBoundary><Wars /></ErrorBoundary>} />
        <Route path="/cwl" element={<ErrorBoundary><CWLPlanner /></ErrorBoundary>} />
        <Route path="/bases" element={<ErrorBoundary><Bases /></ErrorBoundary>} />
        <Route path="/strategies" element={<ErrorBoundary><Strategies /></ErrorBoundary>} />
        <Route path="/announcements" element={<ErrorBoundary><Announcements /></ErrorBoundary>} />
        <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
        <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        <Route path="/admin" element={<ErrorBoundary><AdminPanel /></ErrorBoundary>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
