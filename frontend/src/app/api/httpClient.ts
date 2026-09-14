import { HttpClientError } from './errors';

const CORRELATION_HEADER = 'X-Correlation-Id';

interface ApiErrorPayload {
  code?: string;
  message?: string;
  correlationId?: string;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  assertLocalApiPath(path);
  const correlationId = crypto.randomUUID();
  const headers = new Headers(options.headers);
  headers.set(CORRELATION_HEADER, correlationId);

  const response = await fetchLocal(path, options, headers);
  const responseCorrelationId = response.headers.get(CORRELATION_HEADER);
  if (responseCorrelationId !== correlationId) {
    throw new HttpClientError(
      'correlation',
      'La respuesta local no conserva la correlacion solicitada',
      response.status,
      undefined,
      responseCorrelationId ?? undefined,
    );
  }

  if (!response.ok) {
    throw await responseError(response, correlationId);
  }

  return (await response.json()) as T;
}

async function fetchLocal(path: string, options: RequestInit, headers: Headers): Promise<Response> {
  try {
    return await fetch(path, { ...options, credentials: 'same-origin', headers });
  } catch {
    throw new HttpClientError('network', 'No se pudo contactar al backend local', undefined, undefined, undefined);
  }
}

async function responseError(response: Response, correlationId: string): Promise<HttpClientError> {
  const payload = await errorPayload(response);
  const code = payload?.code;
  const message = payload?.message ?? `El backend local respondio ${response.status}`;
  const errorCorrelationId = payload?.correlationId ?? correlationId;
  const kind = response.status === 401 || code === 'unauthorized' ? 'session' : 'backend';

  return new HttpClientError(kind, message, response.status, code, errorCorrelationId);
}

async function errorPayload(response: Response): Promise<ApiErrorPayload | undefined> {
  try {
    const payload: unknown = await response.json();
    return isApiErrorPayload(payload) ? payload : undefined;
  } catch {
    return undefined;
  }
}

function isApiErrorPayload(payload: unknown): payload is ApiErrorPayload {
  return typeof payload === 'object' && payload !== null;
}

function assertLocalApiPath(path: string): void {
  if (!path.startsWith('/api/') || path.startsWith('//')) {
    throw new HttpClientError(
      'network',
      'El cliente solo permite rutas locales bajo /api',
      undefined,
      undefined,
      undefined,
    );
  }
}
