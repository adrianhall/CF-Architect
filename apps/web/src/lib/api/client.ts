/**
 * apps/web/src/lib/api/client.ts
 *
 * Typed API fetch client.
 *
 * - Reads the CF_CSRF cookie and attaches it as X-CSRF-Token on mutating
 *   requests (POST, PUT, PATCH, DELETE).
 * - Redirects to the dev login page on 401 responses.
 * - Returns a typed ApiResponse discriminated union from @cf-architect/shared.
 */

import type { ApiErrorBody } from "@cf-architect/shared";

// ---------------------------------------------------------------------------
// Cookie helper
// ---------------------------------------------------------------------------

function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const pair of document.cookie.split(";")) {
    const [name, ...rest] = pair.split("=");
    if (name?.trim() === "CF_CSRF") return rest.join("=").trim();
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorBody["details"],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// apiFetch
// ---------------------------------------------------------------------------

/**
 * Typed fetch wrapper. Throws `ApiError` for non-ok responses.
 * On 401, redirects to `/_auth/login` so the user can re-authenticate.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  // Use redirect:"manual" so we intercept the Worker's 302 redirect to
  // /_auth/login instead of letting fetch follow it and return HTML.
  // Same-origin manual redirects return status 0 / type "opaqueredirect".
  const res = await fetch(path, { ...init, headers, redirect: "manual" });

  const isAuthRedirect = res.status === 0 || res.type === "opaqueredirect";
  if (isAuthRedirect || res.status === 401) {
    // Redirect to login; preserve the current path so the user returns here.
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/_auth/login?redirect=${redirect}`;
    // Return a never-resolving promise while the navigation happens.
    return new Promise(() => undefined);
  }

  if (!res.ok) {
    let code = "INTERNAL";
    let message = `HTTP ${res.status}`;
    let details: ApiErrorBody["details"] | undefined;

    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string; details?: ApiErrorBody["details"] };
      };
      if (body.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
        details = body.error.details;
      }
    } catch {
      // Response was not JSON
    }

    throw new ApiError(code, message, res.status, details);
  }

  return res.json() as Promise<T>;
}
