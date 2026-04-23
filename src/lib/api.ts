import { NextResponse } from "next/server";

// ── Response helpers ──────────────────────────────────────────────────────────

/**
 * Standard JSON success response.
 * Pass `init` to set cache headers, status, or other response options.
 */
export function apiOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/**
 * 404 response.
 */
export function apiNotFound(message = "Ikke funnet"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * 400 response for invalid/malformed input.
 */
export function apiBadRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * 500 response. Logs the error with a context prefix so it's easy to grep.
 *
 * @param context  Short label for the log line, e.g. "GET /api/listings".
 * @param error    The caught error.
 * @param message  User-facing Norwegian error message.
 */
export function apiServerError(
  context: string,
  error: unknown,
  message = "Noe gikk galt. Prøv igjen."
): NextResponse {
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
