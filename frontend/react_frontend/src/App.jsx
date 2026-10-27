import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom';
import {Shell} from './components/Layout';
import {Login,Dashboard,Appointments,Patients,Patient,Consultation,History,Prescriptions,LabTests,Profile,Settings} from './pages/Pages';
import './styles.css';
import './legacy-doctor.css';
function Guard({children}) { return localStorage.getItem('doctor_id') && (localStorage.getItem('access_token')||sessionStorage.getItem('access_token')) ? children : <Navigate to="/login" replace/>; }
export default function App(){return <BrowserRouter><Routes><Route path="/login" element={<Login/>}/><Route element={<Guard><Shell/></Guard>}><Route index element={<Dashboard/>}/><Route path="appointments" element={<Appointments/>}/><Route path="patients" element={<Patients/>}/><Route path="patient" element={<Patient/>}/><Route path="consultations" element={<Consultation/>}/><Route path="consultation" element={<Consultation/>}/><Route path="history" element={<History/>}/><Route path="prescriptions" element={<Prescriptions/>}/><Route path="prescription" element={<Prescriptions/>}/><Route path="lab-tests" element={<LabTests/>}/><Route path="profile" element={<Profile/>}/><Route path="settings" element={<Settings/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></BrowserRouter>}
