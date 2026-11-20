import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import Login from './pages/Login'
import ProfileEditPage from './pages/ProfileEditPage'
import ProfilePage from './pages/ProfilePage'
import TalentDetailPage from './pages/TalentDetailPage'
import TalentPage from './pages/TalentPage'

export default function App() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/login" element={<Login />} />

      <Route element={<Layout />}>
        <Route index element={<Home />} />

        <Route element={<ProtectedRoute />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/edit" element={<ProfileEditPage />} />
          <Route path="talent" element={<TalentPage />} />
          <Route path="talent/:membershipNumber" element={<TalentDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
