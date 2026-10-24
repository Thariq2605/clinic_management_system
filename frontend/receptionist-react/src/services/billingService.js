import { receptionistApi } from './api';

const query = (values) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== '' && value != null) params.set(key, value); });
  return params.toString() ? `?${params}` : '';
};
export const billingService = {
  list: (filters = {}) => receptionistApi.get(`/bills/${query(filters)}`),
  detail: (id) => receptionistApi.get(`/bills/${id}/`),
  payments: (id) => receptionistApi.get(`/bills/${id}/payments/`),
  recordPayment: (id, data) => receptionistApi.post(`/bills/${id}/payments/`, data),
};
