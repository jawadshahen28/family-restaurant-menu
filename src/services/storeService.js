import { apiRequest } from './apiClient';
export async function getStore() { return apiRequest('/store'); }
