import { afterEach, describe, expect, it, vi } from 'vitest';

import { request } from './httpClient';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('uses same-origin session credentials and a request correlation id', async () => {
    const correlationId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(correlationId);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ name: 'Zeko' }, correlationId));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request<{ name: string }>('/api/projects')).resolves.toEqual({ name: 'Zeko' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.any(Headers),
      }),
    );
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(options.headers).get('X-Correlation-Id')).toBe(correlationId);
  });

  it('distinguishes an expired local session from backend failures', async () => {
    const correlationId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(correlationId);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ code: 'unauthorized', message: 'Sesion expirada' }, correlationId, 401)),
    );

    await expect(request('/api/session')).rejects.toMatchObject({
      kind: 'session',
      status: 401,
      code: 'unauthorized',
    });
  });

  it('distinguishes a missing response correlation id', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: 'Zeko' }))));

    await expect(request('/api/projects')).rejects.toMatchObject({ kind: 'correlation' });
  });

  it('reports non-session responses as backend errors', async () => {
    const correlationId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(correlationId);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ code: 'conflict', message: 'Estado invalido' }, correlationId, 409)),
    );

    await expect(request('/api/projects')).rejects.toMatchObject({
      kind: 'backend',
      status: 409,
      code: 'conflict',
    });
  });

  it('rejects a non-local endpoint before using fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('https://example.test/api/projects')).rejects.toMatchObject({ kind: 'network' });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: object, correlationId: string, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
  });
}
