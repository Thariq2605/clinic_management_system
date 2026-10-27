import ResourcePage from '../components/ResourcePage.jsx';
import { loadDoctors, resources } from '../services/resources.jsx';
import PatientProfilePanel from './PatientProfilePanel.jsx';

export function UsersPage() { return <ResourcePage {...resources.users} />; }
export function RolesPage() { return <ResourcePage {...resources.roles} />; }
export function DepartmentsPage() { return <ResourcePage {...resources.departments} />; }
export function SpecializationsPage() { return <ResourcePage {...resources.specializations} />; }
export function DoctorsPage() { return <ResourcePage {...resources.staff} />; }
export function DoctorAvailabilityPage() { return <ResourcePage {...resources.doctorAvailability} rowActions={false} />; }
export function ReceptionistsPage() { return <ResourcePage {...resources.receptionists} />; }
export function PatientsPage() { return <ResourcePage {...resources.patients} detailRenderer={(row) => <PatientProfilePanel id={row.patient_id} />}/>; }
export function MedicinesPage() { return <ResourcePage {...resources.medicines} />; }
export function LabTestsPage() { return <ResourcePage {...resources.labTests} />; }

const appointmentColumns = [
  { key: 'appointment_id', label: 'ID', render: (v) => `#${v}` }, { key: 'patient_name', label: 'Patient' },
  { key: 'doctor_name', label: 'Doctor' }, { key: 'appointment_date', label: 'Date' }, { key: 'appointment_time', label: 'Time' },
  { key: 'token_number', label: 'Token' }, { key: 'status', label: 'Status' }, { key: 'payment_status', label: 'Payment' },
];
export function AppointmentsPage() { return <ResourcePage title="Appointments" description="Review and filter appointment records. Mutation is unavailable here because the Admin API does not apply the appointment service rules used by the receptionist workflow." endpoint="/api/admin/appointments/" idKey="appointment_id" columns={appointmentColumns} fields={[]} filters={[{ name: 'doctor', label: 'Doctor', optionsFrom: 'doctors' }, { name: 'date', label: 'Date', type: 'date' }, { name: 'status', label: 'Status', options: ['scheduled', 'confirmed', 'serving', 'completed', 'cancelled'] }]} loadDependencies={loadDoctors} searchHint="Search patient, doctor, or token…" rowActions={false} />; }

const billColumns = [
  { key: 'bill_id', label: 'Bill', render: (v) => `BILL-${String(v).padStart(4, '0')}` }, { key: 'patient_name', label: 'Patient' },
  { key: 'doctor_name', label: 'Doctor' }, { key: 'bill_date', label: 'Date' }, { key: 'total_amount', label: 'Total' },
  { key: 'paid_amount', label: 'Paid' }, { key: 'balance_amount', label: 'Balance' }, { key: 'payment_status', label: 'Status' },
];
export function BillingPage() { return <ResourcePage title="Billing" description="Review bills and balances. Recording payments is unavailable in this screen because the Admin payment API does not apply the existing outstanding-balance and queue rules." endpoint="/api/admin/bills/" idKey="bill_id" columns={billColumns} fields={[]} filters={[{ name: 'payment_status', label: 'Payment status', options: ['pending', 'partial', 'paid'] }, { name: 'date', label: 'Bill date', type: 'date' }]} searchHint="Search bill or patient…" rowActions={false} />; }

const paymentColumns = [
  { key: 'payment_id', label: 'Payment', render: (v) => `#${v}` }, { key: 'bill_id', label: 'Bill', render: (v) => `#${v}` },
  { key: 'patient_name', label: 'Patient' }, { key: 'amount', label: 'Amount' }, { key: 'payment_method', label: 'Method' },
  { key: 'payment_date', label: 'Date' }, { key: 'transaction_reference', label: 'Reference' },
];
export function PaymentsPage() { return <ResourcePage title="Payments" description="View recorded payment records. Create, edit, and delete are disabled because Admin payment mutations do not safely recalculate bill and appointment status." endpoint="/api/admin/payments/" idKey="payment_id" columns={paymentColumns} fields={[]} filters={[{ name: 'payment_method', label: 'Method', options: ['cash', 'card', 'upi', 'online'] }]} searchHint="Search patient, bill, or reference…" rowActions={false} />; }
