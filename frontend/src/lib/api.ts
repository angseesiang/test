import { Assessment, PublicUser } from '../types';

const TOKEN_KEY = 'nist_rmf_token';

const viteEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env;

const API_BASE_URL = (viteEnv?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

function apiUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();

  let data: unknown = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (_error) {
      data = { message: raw };
    }
  }

  if (!response.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof data.message === 'string'
        ? data.message
        : 'Request failed.';

    throw new Error(message);
  }

  return data as T;
}

export async function apiGet<T>(url: string) {
  const response = await fetch(apiUrl(url), {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });

  return parseResponse<T>(response);
}

export async function apiJson<T>(url: string, method: string, body: unknown) {
  const response = await fetch(apiUrl(url), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(body)
  });

  return parseResponse<T>(response);
}

export async function login(email: string, password: string) {
  return apiJson<{ ok: true; user: PublicUser; token: string }>('/api/auth/login', 'POST', { email, password });
}

export async function signup(name: string, email: string, password: string) {
  return apiJson<{ ok: true; user: PublicUser; token: string }>('/api/auth/signup', 'POST', { name, email, password });
}

export async function getMe() {
  return apiGet<{ ok: true; user: PublicUser }>('/api/auth/me');
}

export async function getAssessments() {
  return apiGet<{ ok: true; assessments: Assessment[] }>('/api/assessments');
}

export async function getAssessment(id: string) {
  return apiGet<{ ok: true; assessment: Assessment }>(`/api/assessments/${id}`);
}

export async function createAssessment(formData: FormData) {
  const response = await fetch(apiUrl('/api/assessments'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`
    },
    body: formData
  });

  return parseResponse<{ ok: true; assessment: Assessment }>(response);
}

export async function getUsers() {
  return apiGet<{ ok: true; users: PublicUser[] }>('/api/users');
}

export async function createUser(input: { name: string; email: string; password: string; role: 'admin' | 'user' }) {
  return apiJson<{ ok: true; user: PublicUser }>('/api/users', 'POST', input);
}

export async function updateUser(userId: string, input: Partial<PublicUser>) {
  return apiJson<{ ok: true; user: PublicUser }>(`/api/users/${userId}`, 'PATCH', input);
}

export async function disableUser(userId: string, status: 'active' | 'disabled') {
  return apiJson<{ ok: true; user: PublicUser }>(`/api/users/${userId}/disable`, 'PATCH', { status });
}

export async function removeUser(userId: string) {
  return apiJson<{ ok: true }>(`/api/users/${userId}`, 'DELETE', {});
}