import { adminApi } from './api.js';

export const loadRoles = async () => {
  const rows = await adminApi.get('/api/admin/roles/');
  return { roles: (Array.isArray(rows) ? rows : rows?.results || []).map((r) => ({ value: r.role_id, label: r.role_name })) };
};
export const loadDepartmentsAndStaff = async () => {
  const [departments, staff, specializations] = await Promise.all([
    adminApi.get('/api/admin/departments/'), adminApi.get('/api/admin/staff/'), adminApi.get('/api/admin/specializations/'),
  ]);
  const list = (v) => Array.isArray(v) ? v : v?.results || [];
  return {
    departments: list(departments).map((x) => ({ value: x.department_id, label: x.department_name })),
    staff: list(staff).map((x) => ({ value: x.staff_id, label: x.full_name })),
    specializations: list(specializations).map((x) => ({ value: x.specialization_id, label: x.specialization_name })),
  };
};
export const loadDoctors = async () => {
  const rows = await adminApi.get('/api/admin/doctors/');
  return { doctors: (Array.isArray(rows) ? rows : rows?.results || []).map((r) => ({ value: r.doctor_id, label: r.doctor_name })) };
};

const text = (name, label, required = true, extra = {}) => ({ name, label, required, ...extra });
const select = (name, label, optionsFrom, extra = {}) => ({ name, label, type: 'select', optionsFrom, required: true, ...extra });
const active = { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true, required: false };
const statusColumn = { key: 'is_active', label: 'Status', render: (v) => <span className={`badge ${v ? 'green' : 'gray'}`}>{v ? 'Active' : 'Inactive'}</span> };

export const resources = {
  users: {
    title: 'Users', description: 'Manage accounts and their system roles.', endpoint: '/api/admin/users/', idKey: 'user_id', searchHint: 'Search username…', loadDependencies: loadRoles,
    filters: [{ name: 'role', label: 'Roles', optionsFrom: 'roles' }, { name: 'status', label: 'Status', options: ['active', 'inactive'] }],
    columns: [{ key: 'username', label: 'Username' }, { key: 'role_name', label: 'Role' }, statusColumn],
    fields: [{ ...text('username', 'Username'), validation: 'username', maxLength: 50 }, select('role', 'Role', 'roles'), { ...text('password', 'Password', true, { type: 'password', autoComplete: 'new-password', createOnly: true }) }, { ...text('password', 'New password (leave blank to keep current)', false, { type: 'password', autoComplete: 'new-password', editOnly: true, omitEmpty: true }) }, active],
  },
  roles: {
    title: 'Roles', description: 'Manage role records used by user accounts.', endpoint: '/api/admin/roles/', idKey: 'role_id',
    columns: [{ key: 'role_name', label: 'Role' }, statusColumn], fields: [text('role_name', 'Role name'), active],
  },
  departments: {
    title: 'Departments', description: 'Maintain clinic departments and their availability.', endpoint: '/api/admin/departments/', idKey: 'department_id',
    filters: [{ name: 'status', label: 'Status', options: ['active', 'inactive'] }], columns: [{ key: 'department_name', label: 'Department' }, { key: 'description', label: 'Description' }, { key: 'doctor_count', label: 'Active doctors' }, statusColumn],
    fields: [text('department_name', 'Department name'), text('description', 'Description', true, { type: 'textarea' }), active],
  },
  specializations: {
    title: 'Specializations', description: 'Manage doctor specializations.', endpoint: '/api/admin/specializations/', idKey: 'specialization_id', columns: [{ key: 'specialization_name', label: 'Specialization' }, { key: 'doctor_count', label: 'Active doctors' }],
    fields: [text('specialization_name', 'Specialization name')],
  },
  staff: {
    title: 'Doctors', description: 'Manage doctor records and their staff associations.', endpoint: '/api/admin/doctors/', idKey: 'doctor_id', searchHint: 'Search doctor, license, or qualification…', loadDependencies: loadDepartmentsAndStaff,
    filters: [{ name: 'department', label: 'Department', optionsFrom: 'departments' }, { name: 'status', label: 'Status', options: ['active', 'inactive'] }], columns: [{ key: 'doctor_name', label: 'Doctor' }, { key: 'department_name', label: 'Department' }, { key: 'specialization_name', label: 'Specialization' }, { key: 'consultation_fee', label: 'Consultation fee' }, statusColumn],
    fields: [select('staff', 'Staff member', 'staff'), select('department', 'Department', 'departments'), select('specialization', 'Specialization', 'specializations'), { ...text('consultation_fee', 'Consultation fee', true, { type: 'number', min: 0, step: '0.01', maxDigits: 10, decimalPlaces: 2 }) }, { ...text('qualification', 'Qualification'), maxLength: 100 }, { ...text('experience_years', 'Years of experience', true, { type: 'number', min: 0, integer: true }) }, { ...text('license_number', 'License number'), maxLength: 50 }, active],
  },
  doctorAvailability: {
    title: 'Doctor availability', description: 'Maintain recurring weekly working intervals. Doctors without an active interval cannot be booked.',
    endpoint: '/api/admin/doctor-availability/', idKey: 'availability_id', loadDependencies: loadDoctors,
    columns: [{ key: 'doctor_name', label: 'Doctor' }, { key: 'weekday_name', label: 'Weekday' }, { key: 'start_time', label: 'Starts' }, { key: 'end_time', label: 'Ends' }, statusColumn],
    fields: [select('doctor', 'Doctor', 'doctors'), { name: 'weekday', label: 'Weekday', type: 'select', required: true, options: [{ value: 0, label: 'Monday' }, { value: 1, label: 'Tuesday' }, { value: 2, label: 'Wednesday' }, { value: 3, label: 'Thursday' }, { value: 4, label: 'Friday' }, { value: 5, label: 'Saturday' }, { value: 6, label: 'Sunday' }] }, { ...text('start_time', 'Start time', true, { type: 'time' }) }, { ...text('end_time', 'End time', true, { type: 'time' }) }, active],
  },
  receptionists: {
    title: 'Receptionists', description: 'Manage receptionist staff accounts and their active status.', endpoint: '/api/admin/staff/', idKey: 'staff_id', searchHint: 'Search name, email, or mobile…', baseParams: { role: 'Receptionist' }, loadDependencies: async () => { const [roles, other] = await Promise.all([loadRoles(), adminApi.get('/api/admin/departments/')]); const ds = Array.isArray(other) ? other : other?.results || []; return { ...roles, departments: ds.map((d) => ({ value: d.department_id, label: d.department_name })) }; },
    filters: [{ name: 'status', label: 'Status', options: ['active', 'inactive'] }], columns: [{ key: 'full_name', label: 'Name' }, { key: 'role_name', label: 'Role' }, { key: 'department_name', label: 'Department' }, { key: 'mobile_number', label: 'Mobile' }, statusColumn],
    fields: [{ ...text('username', 'Username', true, { createOnly: true, maxLength: 50 }) }, text('password', 'Initial password', true, { type: 'password', autoComplete: 'new-password', createOnly: true }), { ...text('full_name', 'Full name'), maxLength: 100 }, { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other'] }, { ...text('dob', 'Date of birth', true, { type: 'date', validation: 'date-of-birth' }) }, { ...text('mobile_number', 'Mobile number', true, { type: 'tel', maxLength: 10, validation: 'mobile' }) }, { ...text('email', 'Email', true, { type: 'email', maxLength: 100 }) }, select('department', 'Department', 'departments'), { ...select('role', 'Role', 'roles'), createOnly: true }, active],
  },
  patients: {
    title: 'Patients', description: 'Review and maintain patient demographic records.', endpoint: '/api/admin/patients/', idKey: 'patient_id', searchHint: 'Search name, mobile, or email…',
    filters: [{ name: 'gender', label: 'Gender', options: ['Male', 'Female', 'Other'] }, { name: 'blood_group', label: 'Blood group', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }, { name: 'status', label: 'Status', options: ['active', 'inactive'] }], columns: [{ key: 'full_name', label: 'Patient' }, { key: 'mobile_number', label: 'Mobile' }, { key: 'email', label: 'Email' }, { key: 'age', label: 'Age' }, { key: 'blood_group', label: 'Blood group' }, statusColumn],
    fields: [{ ...text('full_name', 'Full name'), maxLength: 100 }, { ...text('dob', 'Date of birth', true, { type: 'date', validation: 'date-of-birth' }) }, { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other'] }, { ...text('mobile_number', 'Mobile number', true, { type: 'tel', maxLength: 10, validation: 'mobile' }) }, { ...text('email', 'Email', true, { type: 'email', maxLength: 100 }) }, { ...text('address', 'Address', true, { type: 'textarea', maxLength: 255 }) }, { name: 'blood_group', label: 'Blood group', type: 'select', required: true, options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }, { ...text('emergency_contact', 'Emergency contact', true, { type: 'tel', maxLength: 10, validation: 'mobile' }) }, active],
  },
  medicines: {
    title: 'Medicines', description: 'Maintain medicine catalog and stock quantities.', endpoint: '/api/admin/medicines/', idKey: 'medicine_id', searchHint: 'Search medicine or manufacturer…',
    filters: [{ name: 'stock_status', label: 'Stock status', options: ['Available', 'Low Stock', 'Expired'] }], columns: [{ key: 'medicine_name', label: 'Medicine' }, { key: 'manufacturer', label: 'Manufacturer' }, { key: 'unit_price', label: 'Unit price' }, { key: 'quantity', label: 'Quantity' }, { key: 'expiry_date', label: 'Expiry' }, { key: 'stock_status', label: 'Stock status', render: (v) => <span className={`badge ${v === 'Available' ? 'green' : v === 'Expired' ? 'red' : 'amber'}`}>{v}</span> }, statusColumn],
    fields: [{ ...text('medicine_name', 'Medicine name'), maxLength: 100 }, { ...text('manufacturer', 'Manufacturer'), maxLength: 100 }, { ...text('unit_price', 'Unit price', true, { type: 'number', min: 0, step: '0.01', maxDigits: 10, decimalPlaces: 2 }) }, { ...text('quantity', 'Quantity', true, { type: 'number', min: 0, step: '1', integer: true }) }, { ...text('expiry_date', 'Expiry date', true, { type: 'date' }) }, active],
  },
  labTests: {
    title: 'Lab tests', description: 'Manage available laboratory test catalog entries.', endpoint: '/api/admin/lab-tests/', idKey: 'test_id', searchHint: 'Search test or type…',
    filters: [{ name: 'test_type', label: 'Category', options: ['blood', 'urine', 'imaging', 'biochemistry'] }, { name: 'status', label: 'Status', options: ['active', 'inactive'] }], columns: [{ key: 'test_name', label: 'Test' }, { key: 'test_type', label: 'Type' }, { key: 'test_fee', label: 'Fee' }, { key: 'normal_range', label: 'Normal range' }, statusColumn],
    fields: [{ ...text('test_name', 'Test name'), maxLength: 100 }, { ...text('test_type', 'Test type'), maxLength: 50 }, { ...text('description', 'Description', true, { type: 'textarea', maxLength: 255 }) }, { ...text('test_fee', 'Test fee', true, { type: 'number', min: 0, step: '0.01', maxDigits: 10, decimalPlaces: 2 }) }, { ...text('normal_range', 'Normal range'), maxLength: 100 }, active],
  },
};
