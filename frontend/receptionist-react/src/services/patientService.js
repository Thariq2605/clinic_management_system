import { receptionistApi } from './api';

const query = (values) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== '' && value != null) params.set(key, value); });
  return params.toString() ? `?${params}` : '';
};
export const patientService = {
  search: (search) => {
    const value = search.trim();
    const idMatch = value.match(/^#?(\d{1,9})$/);
    return receptionistApi.get(`/patients/${query(idMatch ? { patient_id: idMatch[1] } : { search: value })}`);
  },
  byId: (id) => receptionistApi.get(`/patients/${id}/`),
  create: (data) => receptionistApi.post('/patients/', data),
  update: (id, data) => receptionistApi.patch(`/patients/${id}/`, data),
  setActive: (id, is_active) => receptionistApi.patch(`/patients/${id}/status/`, { is_active }),
  appointments: (search) => receptionistApi.get(`/appointments/?search=${encodeURIComponent(search)}`),
};
