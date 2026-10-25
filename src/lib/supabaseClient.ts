import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AgentResponse,
  DashboardSummary,
  GitHubConnectionState,
  Project,
  Task,
  Transaction,
  UserSession,
} from '../types/studioos.ts';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isBrowserSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-ref');

export const supabaseBrowserClient: SupabaseClient | null = isBrowserSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) errMsg = body.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

export const studioApi = {
  getSession: () => apiRequest<UserSession>('/api/auth/session'),
  login: (email: string, password?: string) =>
    apiRequest<UserSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    apiRequest<UserSession>('/api/auth/logout', {
      method: 'POST',
    }),

  getDashboard: () => apiRequest<DashboardSummary>('/api/dashboard'),

  getProjects: (includeArchived = true) =>
    apiRequest<Project[]>(`/api/projects?includeArchived=${includeArchived}`),
  createProject: (data: Partial<Project>) =>
    apiRequest<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProject: (id: string, data: Partial<Project>) =>
    apiRequest<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  archiveProject: (id: string) =>
    apiRequest<Project>(`/api/projects/${id}/archive`, {
      method: 'POST',
    }),

  getTasks: (projectId?: string) =>
    apiRequest<Task[]>(`/api/tasks${projectId ? `?projectId=${projectId}` : ''}`),
  createTask: (data: Partial<Task>) =>
    apiRequest<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTask: (id: string, data: Partial<Task>) =>
    apiRequest<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTask: (id: string) =>
    apiRequest<{ deleted: boolean }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),

  getTransactions: () => apiRequest<Transaction[]>('/api/transactions'),
  createTransaction: (data: Partial<Transaction>) =>
    apiRequest<Transaction>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteTransaction: (id: string) =>
    apiRequest<{ deleted: boolean }>(`/api/transactions/${id}`, {
      method: 'DELETE',
    }),

  askStudioOS: (question: string) =>
    apiRequest<AgentResponse>('/api/agent/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  resetSeedData: () =>
    apiRequest<{ reset: boolean }>('/api/seed/reset', {
      method: 'POST',
    }),

  getGitHubAuthUrl: () =>
    apiRequest<{ url: string; configured: boolean; callbackUrl: string }>(
      '/api/github/auth/url'
    ),
  getGitHubStatus: (refresh = false) =>
    apiRequest<GitHubConnectionState>(`/api/github/status?refresh=${refresh}`),
  lookupGitHubTarget: (target: string) =>
    apiRequest<GitHubConnectionState>('/api/github/lookup', {
      method: 'POST',
      body: JSON.stringify({ target }),
    }),
  disconnectGitHub: () =>
    apiRequest<GitHubConnectionState>('/api/github/disconnect', {
      method: 'POST',
    }),
};
