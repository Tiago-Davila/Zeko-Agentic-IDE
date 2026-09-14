export type HttpErrorKind = 'session' | 'correlation' | 'backend' | 'network';

export class HttpClientError extends Error {
  readonly kind: HttpErrorKind;
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly correlationId: string | undefined;

  constructor(
    kind: HttpErrorKind,
    message: string,
    status: number | undefined,
    code: string | undefined,
    correlationId: string | undefined,
  ) {
    super(message);
    this.name = 'HttpClientError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}
