export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';
export const AUTH_EXPIRED_EVENT = 'tinh-cong:auth-expired';

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; employeeId: string | null; roles: string[] };
}

let refreshPromise: Promise<string> | null = null;

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly payload?: unknown) {
    super(message);
  }
}

export function clearAuthSession() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('refresh_token');
  sessionStorage.removeItem('auth_user');
}

function expireAuthSession() {
  clearAuthSession();
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

async function refreshAccessToken() {
  const refreshToken = sessionStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('Missing refresh token');

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) throw new Error('Refresh token is invalid or expired');

  const result = (await response.json()) as RefreshResult;
  sessionStorage.setItem('access_token', result.accessToken);
  sessionStorage.setItem('refresh_token', result.refreshToken);
  sessionStorage.setItem('auth_user', JSON.stringify(result.user));
  return result.accessToken;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('access_token');
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const canRefresh = path !== '/auth/login' && path !== '/auth/refresh';
  if (response.status === 401 && canRefresh && sessionStorage.getItem('refresh_token')) {
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const refreshedToken = await refreshPromise;
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch {
      expireAuthSession();
      throw new ApiError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Yêu cầu thất bại (${response.status})`;
    if (response.status === 401 && canRefresh) expireAuthSession();
    throw new ApiError(response.status, message, payload);
  }
  return response.json() as Promise<T>;
}

export function formatSeconds(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const seconds = absolute % 60;
  return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
