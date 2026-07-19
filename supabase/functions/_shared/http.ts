export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'TEMPORARY_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ResponseEnvelope<T> {
  data: T | null;
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  } | null;
  meta: {
    requestId: string;
    generatedAt: string;
  };
}

export function buildCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = origin ?? '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

export function requestIdFromHeaders(headers: Headers): string {
  return headers.get('x-request-id') ?? crypto.randomUUID();
}

export function jsonOk<T>(requestId: string, data: T, init?: ResponseInit): Response {
  const body: ResponseEnvelope<T> = {
    data,
    error: null,
    meta: {
      requestId,
      generatedAt: new Date().toISOString(),
    },
  };
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

export function jsonError(
  requestId: string,
  code: ErrorCode,
  message: string,
  status: number,
  init?: ResponseInit,
): Response {
  const body: ResponseEnvelope<never> = {
    data: null,
    error: {
      code,
      message,
      requestId,
    },
    meta: {
      requestId,
      generatedAt: new Date().toISOString(),
    },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: init?.headers,
  });
}
