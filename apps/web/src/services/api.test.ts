import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizedFetch, setAccessToken } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('API authentication recovery', () => {
  it('renews the access token once and retries a protected request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'fresh-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ documents: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('expired-token');

    const response = await authorizedFetch('/api/v1/documents');
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retriedOptions = fetchMock.mock.calls[2][1] as RequestInit;
    expect(new Headers(retriedOptions.headers).get('Authorization')).toBe('Bearer fresh-token');
  });
});
