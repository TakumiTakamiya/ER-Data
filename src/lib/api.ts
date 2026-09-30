import type { ApiErrorBody } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code = 'UNKNOWN') { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null) as T | ApiErrorBody | null;
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? body.error : null;
    throw new ApiError(error?.message ?? '通信に失敗しました。', response.status, error?.code);
  }
  return body as T;
}

export const getJson = <T>(path: string) => api<T>(path);
export const sendJson = <T>(path: string, method: 'POST' | 'PUT', value: unknown) => api<T>(path, { method, body: JSON.stringify(value) });
export const deleteJson = <T>(path: string) => api<T>(path, { method: 'DELETE' });
