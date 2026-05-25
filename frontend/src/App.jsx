import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import TicketsPage from './pages/TicketsPage'
import TicketDetailPage from './pages/TicketDetailPage'
import NewTicketPage from './pages/NewTicketPage'
import UsersPage from './pages/UsersPage'
import GroupsPage from './pages/GroupsPage'
import TicketRequestPage from './pages/TicketRequestPage'
import PortalTicketsPage from './pages/PortalTicketsPage'
import PortalTicketDetailPage from './pages/PortalTicketDetailPage'
import PortalChangePasswordPage from './pages/PortalChangePasswordPage'
import SetupPage from './pages/SetupPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { background: '#0d1b3e', color: '#e0e0e0', border: '1px solid #00d4ff33', borderRadius: '8px', fontSize: '0.85rem' },
        success: { iconTheme: { primary: '#22c55e', secondary: '#0d1b3e' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#0d1b3e' } },
      }} />
      <AuthProvider>
        <NotificationProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/tickets" element={
            <ProtectedRoute><TicketsPage /></ProtectedRoute>
          } />
          <Route path="/tickets/new" element={
            <ProtectedRoute><NewTicketPage /></ProtectedRoute>
          } />
          <Route path="/tickets/:id" element={
            <ProtectedRoute><TicketDetailPage /></ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute><UsersPage /></ProtectedRoute>
          } /></ProtectedRoute>
          } />
          <Route path="/groups" element={
            <ProtectedRoute><GroupsPage /></ProtectedRoute>
          } />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/ticket-beantragen" element={<TicketRequestPage />} />
          <Route path="/portal" element={
            <ProtectedRoute><PortalTicketsPage /></ProtectedRoute>
          } />
          <Route path="/portal/passwort" element={
            <ProtectedRoute><PortalChangePasswordPage /></ProtectedRoute>
          } />
          <Route path="/portal/tickets/:id" element={
            <ProtectedRoute><PortalTicketDetailPage /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute><AdminPage /></ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute><ProfilePage /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
