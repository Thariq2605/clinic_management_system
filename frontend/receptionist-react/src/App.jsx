import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ReceptionistLayout from './layouts/ReceptionistLayout';
import Login from './pages/Login'; import Dashboard from './pages/Dashboard'; import Patients from './pages/Patients'; import PatientDetail from './pages/PatientDetail'; import Appointments from './pages/Appointments'; import AppointmentDetail from './pages/AppointmentDetail'; import Queue from './pages/Queue'; import Billing from './pages/Billing'; import Doctors from './pages/Doctors';
import Loading from './components/common/Loading';
import ErrorState from './components/common/ErrorState';

function ProtectedRoute() { const { user, checking, sessionError, retrySession } = useAuth(); const location = useLocation(); if (checking) return <Loading label="Checking your receptionist session…" />; if (sessionError) return <ErrorState message={sessionError} onRetry={retrySession} />; return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />; }
export default function App() {
  return <Routes><Route path="/login" element={<Login />} /><Route element={<ProtectedRoute />}><Route element={<ReceptionistLayout />}><Route index element={<Dashboard />} /><Route path="patients" element={<Patients />} /><Route path="patients/:id" element={<PatientDetail />} /><Route path="appointments" element={<Appointments />} /><Route path="appointments/new" element={<Appointments />} /><Route path="appointments/:id" element={<AppointmentDetail />} /><Route path="queue" element={<Queue />} /><Route path="billing" element={<Billing />} /><Route path="doctors" element={<Doctors />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
