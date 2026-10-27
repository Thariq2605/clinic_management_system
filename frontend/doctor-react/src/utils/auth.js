import { resolveSharedLoginUrl } from './sharedLogin.js';
const keys = ['access_token','refresh_token','doctor_id','doctor_name','user_id','username','current_appointment_id'];
export const getToken = () => localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
export const getRefresh = () => localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
export function saveLogin(data, remember) {
  const store = remember ? localStorage : sessionStorage;
  store.setItem('access_token', data.access); store.setItem('refresh_token', data.refresh);
  for (const key of ['access_token','refresh_token']) (remember ? sessionStorage : localStorage).removeItem(key);
  for (const key of ['doctor_id','doctor_name','user_id','username']) localStorage.setItem(key, data[key]);
}
export function clearLogin() { keys.forEach(k => {localStorage.removeItem(k);sessionStorage.removeItem(k);}); }
export function logoutDoctor(loginUrl = resolveSharedLoginUrl(import.meta.env.VITE_SHARED_LOGIN_URL, import.meta.env.DEV)) { clearLogin(); window.location.replace(loginUrl); }
export const doctorId = () => localStorage.getItem('doctor_id');
