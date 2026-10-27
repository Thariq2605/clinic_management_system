import { resolveApiOrigin } from './apiCore.js';

export const API_ORIGIN = resolveApiOrigin(import.meta.env.VITE_API_BASE_URL);
