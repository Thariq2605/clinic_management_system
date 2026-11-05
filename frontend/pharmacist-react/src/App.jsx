import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './app/AuthContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { DashboardPage, DispensingPage, InventoryPage, MedicinesPage, PrescriptionsPage, ProfilePage, SettingsPage } from './pages/PharmacyPages.jsx';
import { ErrorState, Loading } from './components/States.jsx';

function Guard() {
  const auth = useAuth(); const location = useLocation();
  if (auth.status === 'checking') return <Loading label="Validating your Pharmacist session…" />;
  if (auth.status === 'error') return <ErrorState message={auth.error} retry={auth.retry} />;
  if (auth.status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppLayout />;
}
function AppRoutes() {
  const { status } = useAuth();
  return <Routes><Route path="/login" element={status === 'checking' ? <Loading label="Checking your session…" /> : <LoginPage />} /><Route element={<Guard />}><Route index element={<DashboardPage />} /><Route path="prescriptions" element={<PrescriptionsPage />} /><Route path="medicines" element={<MedicinesPage />} /><Route path="inventory" element={<InventoryPage />} /><Route path="dispensing" element={<DispensingPage />} /><Route path="profile" element={<ProfilePage />} /><Route path="settings" element={<SettingsPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }
