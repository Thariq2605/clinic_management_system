import { receptionistApi } from './api';

export const queueService = {
  today: (doctor = '') => receptionistApi.get(`/token-queue/today/${doctor ? `?doctor=${encodeURIComponent(doctor)}` : ''}`),
  callNext: (doctor = '') => receptionistApi.post('/token-queue/call-next/', doctor ? { doctor } : {}),
  complete: (appointmentId) => receptionistApi.post(`/token-queue/${appointmentId}/complete/`, {}),
};
