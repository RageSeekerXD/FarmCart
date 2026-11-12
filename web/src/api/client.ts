import type { ApiErrorBody } from './types';

/** Помилка API: машинний код (за ним інтерфейс обирає переклад) і HTTP-статус. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const TOKEN_KEY = 'farmcart.token';

let unauthorizedHandler: (() => void) | null = null;

export const session = {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set token(value: string | null) {
    if (value === null) {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, value);
    }
  },
  /** Викликається, коли сервер відхилив збережену сесію (401): застосунок повертає користувача на вхід. */
  onUnauthorized(handler: (() => void) | null) {
    unauthorizedHandler = handler;
  },
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  const token = session.token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`${location.origin}/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(0, 'network', 'Network error');
  }

  if (response.ok) {
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  const body = await readError(response);
  if (response.status === 401 && token) {
    session.token = null;
    unauthorizedHandler?.();
  }

  throw new ApiError(response.status, body.error, body.message);
}

async function readError(response: Response): Promise<ApiErrorBody> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (typeof body.error === 'string') {
      return { error: body.error, message: body.message ?? '' };
    }
  } catch {
    // Тіло не JSON (наприклад, 502 від проксі) - нижче повертаємо загальний код.
  }

  return { error: response.status >= 500 ? 'server' : 'unknown', message: '' };
}
