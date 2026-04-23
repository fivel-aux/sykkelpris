/**
 * Generic API success response wrapper
 */
export type ApiSuccess<T> = {
  data: T;
  ok: true;
};

/**
 * Generic API error response
 */
export type ApiError = {
  ok: false;
  error: string;
  details?: unknown;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Simple helper to build a typed success response
 */
export function ok<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

/**
 * Simple helper to build a typed error response
 */
export function err(message: string, details?: unknown): ApiError {
  return { ok: false, error: message, details };
}
