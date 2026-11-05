import { request, rows } from './api.js';
export async function getMedicines() { return rows(await request('/pharmacist/medicines/')); }
export async function getItems() { return rows(await request('/pharmacist/prescription-medicines/')); }
export async function getPrescriptions() { return rows(await request('/pharmacist/prescriptions/')); }
export async function getPharmacyData() { return Promise.all([getMedicines(), getItems(), getPrescriptions()]); }
export function saveMedicine(id, values) { return request(`/pharmacist/medicines/${id ? `${id}/` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify({ ...values, is_active: true }) }); }
export function deleteMedicine(id) { return request(`/pharmacist/medicines/${id}/`, { method: 'DELETE' }); }
export function dispenseItem(id) { return request(`/pharmacist/prescription-medicines/${id}/dispense/`, { method: 'POST' }); }
