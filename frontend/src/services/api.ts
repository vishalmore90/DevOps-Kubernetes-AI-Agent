import axios from 'axios';
import { InvestigationResponse } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

export const getContexts = async (): Promise<{ contexts: string[], current_context: string | null, kubeconfig_path?: string | null }> => {
  const response = await apiClient.get('/contexts');
  return response.data;
};

export const triggerInvestigation = async (userId?: string, context?: string): Promise<InvestigationResponse> => {
  const response = await apiClient.post<InvestigationResponse>('/investigate', { userId, context });
  return response.data;
};
