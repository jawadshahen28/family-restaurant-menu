import { apiRequest } from './apiClient.js';
export async function getStore() { return apiRequest('/store'); }
