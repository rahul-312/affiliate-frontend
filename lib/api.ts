/**
 * The only way the dashboard talks to the backend. No business rules live in
 * Next.js: every action is an authenticated call to the Express API.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 45_000; // Render's free tier can take ~30s to wake up.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called when the API rejects our token, so the app can sign out cleanly. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  if (!API_URL) throw new ApiError(0, 'CONFIG', 'NEXT_PUBLIC_API_URL is not configured');
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function send(path: string, { method = 'GET', body, query }: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = payload?.error;
    if (response.status === 401 && authToken) onUnauthorized?.();
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }
  return response;
}

export async function apiRequest<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await send(path, options);
  return (await response.json()) as T;
}

/** Downloads an authenticated file (e.g. the payout CSV) and hands it to the browser. */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const response = await send(path);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Human-readable message for any thrown value, including field-level validation details. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
      return err.details
        .map((d: { field?: string | null; message?: string }) => (d.field ? `${d.field}: ${d.message}` : d.message))
        .join('; ');
    }
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
