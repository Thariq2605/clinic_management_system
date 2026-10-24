import { receptionistApi } from './api';

const query = (values) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== '' && value != null) params.set(key, value); });
  return params.toString() ? `?${params}` : '';
};
export const appointmentService = {
  list: (filters = {}) => receptionistApi.get(`/appointments/${query(filters)}`),
  detail: (id) => receptionistApi.get(`/appointments/${id}/`),
  create: (data) => receptionistApi.post('/appointments/', data),
  cancel: (id) => receptionistApi.patch(`/appointments/${id}/`, {}),
  departments: () => receptionistApi.get('/departments/'),
  doctors: (department) => receptionistApi.get(`/doctors/${query({ department })}`),
  doctorAvailability: (id) => receptionistApi.get(`/doctors/${id}/availability/`),
};
