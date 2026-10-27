import axios from 'axios';
import { getToken, getRefresh, clearLogin } from '../utils/auth';
import { resolveSharedLoginUrl } from '../utils/sharedLogin.js';
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000', headers: {'Content-Type':'application/json'} });
api.interceptors.request.use(config => { const token = getToken(); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
let refreshing;
api.interceptors.response.use(r => r, async error => {
 const original = error.config;
 if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/doctor/token/refresh/')) {
   const refresh = getRefresh(); if (!refresh) { clearLogin(); window.location.replace(resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV)); return Promise.reject(error); }
   original._retry = true;
   try {
     refreshing ||= axios.post(`${api.defaults.baseURL}/doctor/token/refresh/`, {refresh});
     const {data} = await refreshing; refreshing = null;
     const store = localStorage.getItem('refresh_token') ? localStorage : sessionStorage;
     store.setItem('access_token', data.access); original.headers.Authorization = `Bearer ${data.access}`;
     return api(original);
   } catch (e) { refreshing = null; clearLogin(); window.location.replace(resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV)); return Promise.reject(e); }
 }
 return Promise.reject(error);
});
export const doctorApi = {
 login: payload => axios.post(`${api.defaults.baseURL}/doctor/login/`, payload),
 dashboard: id => api.get(`/doctor/dashboard/${id}/`), appointments: id => api.get(`/doctor/appointments/${id}/`),
 patient: (id, appointment) => api.get(`/doctor/appointments/${id}/${appointment}/patient/`),
 searchPatients: (id, search) => api.get(`/doctor/patients/${id}/search/`, {params:{search}}),
 patientHistory: (id, patient) => api.get(`/doctor/patients/${id}/${patient}/history/`),
 medicalHistory: (id, patient) => api.get(`/doctor/history/${id}/`, {params: patient ? {patient_id:patient} : {}}),
 consultations: id => api.get(`/doctor/consultations/${id}/`),
 createConsultation: (id, appointment, payload) => api.post(`/doctor/appointments/${id}/${appointment}/consultation/`, payload),
 medicines: () => api.get('/doctor/medicines/'), prescriptions: id => api.get(`/doctor/prescriptions/${id}/`),
 createPrescription: (id, consultation, payload) => api.post(`/doctor/consultations/${id}/${consultation}/prescription/`, payload),
 labCatalog: () => api.get('/doctor/lab-tests/'), labRequests: id => api.get(`/doctor/lab-test-requests/${id}/`), labResults: id => api.get(`/doctor/lab-results/${id}/`),
 createLabRequest: (id, consultation, payload) => api.post(`/doctor/consultations/${id}/${consultation}/lab-test/`, payload),
 records: id => api.get(`/doctor/medical-records/${id}/`), createRecord: (id, consultation) => api.post(`/doctor/consultations/${id}/${consultation}/medical-record/`, {})
};
export function apiError(error) { const d=error.response?.data; if(typeof d==='string') return d; if(d?.error) return d.error; if(d?.detail) return d.detail; if(d && typeof d==='object') return Object.entries(d).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' · '); return error.message || 'Request failed. Please try again.'; }
