let accessToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export const AUTH_EXPIRED_EVENT = 'documind:auth-expired';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function renewAccessToken(): Promise<void> {
  refreshPromise ??= (async () => {
    const response = await fetch(apiUrl('/api/v1/auth/refresh'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', credentials: 'include',
    });
    if (!response.ok) throw new Error('SESSION_EXPIRED');
    const session = await response.json() as { accessToken: string };
    setAccessToken(session.accessToken);
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

function emitAuthExpired(): void {
  setAccessToken(null);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

async function readError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
  return new ApiError(response.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'Request failed.');
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authorizedFetch(path, options);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function authorizedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const send = () => {
    const headers = new Headers(options.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    return fetch(apiUrl(path), { ...options, headers, credentials: 'include' });
  };

  let response = await send();
  if (response.status === 401 && !path.startsWith('/api/v1/auth/')) {
    try {
      await renewAccessToken();
      response = await send();
    } catch {
      emitAuthExpired();
      throw await readError(response);
    }
  }
  if (!response.ok) throw await readError(response);
  return response;
}
