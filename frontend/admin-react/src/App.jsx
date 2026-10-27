import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGate, AuthProvider } from './app/AuthContext.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { AppointmentsPage, BillingPage, DepartmentsPage, DoctorAvailabilityPage, DoctorsPage, LabTestsPage, MedicinesPage, PatientsPage, PaymentsPage, ReceptionistsPage, RolesPage, SpecializationsPage, UsersPage } from './pages/ResourcePages.jsx';

function NotFound() { return <section className="page"><div className="empty-state panel"><span className="empty-icon">404</span><h1>Page not found</h1><p>This Admin page does not exist.</p></div></section>; }

export default function App() {
  return <AuthProvider><AuthGate><Routes><Route element={<AdminLayout />}>
    <Route index element={<DashboardPage />} />
    <Route path="pages/admin_dashboard.html" element={<DashboardPage />} />
    <Route path="users" element={<UsersPage />} /><Route path="roles" element={<RolesPage />} />
    <Route path="doctors" element={<DoctorsPage />} /><Route path="receptionists" element={<ReceptionistsPage />} />
    <Route path="doctor-availability" element={<DoctorAvailabilityPage />} />
    <Route path="patients" element={<PatientsPage />} /><Route path="departments" element={<DepartmentsPage />} />
    <Route path="specializations" element={<SpecializationsPage />} /><Route path="medicines" element={<MedicinesPage />} />
    <Route path="lab-tests" element={<LabTestsPage />} /><Route path="appointments" element={<AppointmentsPage />} />
    <Route path="billing" element={<BillingPage />} /><Route path="payments" element={<PaymentsPage />} />
    <Route path="reports" element={<ReportsPage />} /><Route path="settings" element={<SettingsPage />} />
    <Route path="*" element={<NotFound />} />
  </Route></Routes></AuthGate></AuthProvider>;
}
