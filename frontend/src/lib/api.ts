import { Assessment, PublicUser } from '../types';

const TOKEN_KEY = 'nist_rmf_token';

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
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed.');
  }

  return data as T;
}

export async function apiGet<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });

  return parseResponse<T>(response);
}

export async function apiJson<T>(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
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
  const response = await fetch('/api/assessments', {
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
