export const technicianAuthKeys = [
  'lab_technician_access_token', 'lab_technician_refresh_token', 'lab_technician_id',
  'lab_technician_user_id', 'lab_technician_username', 'lab_technician_name',
];

export function clearTechnicianAuth(storage) {
  technicianAuthKeys.forEach(key => storage.removeItem(key));
}
