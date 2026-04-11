import { SignJWT } from "jose";
import { getSessionUser } from "@/lib/auth/session";

const API_URL = process.env.HONO_API_URL;

/**
 * Check if Hono API mode is enabled.
 * When HONO_API_URL is not set, query files should fall back to direct DB access.
 */
export function isApiMode(): boolean {
  return !!API_URL;
}

/**
 * Sign a short-lived JWT for Hono API calls.
 * Uses AUTH_SECRET (same key Hono verifies with HS256).
 */
async function getApiToken(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m") // short-lived — only for this SSR request
    .sign(secret);
}

/**
 * Typed fetch wrapper for Hono API.
 * Auto-attaches JWT, unwraps `{ data }` envelope, handles errors.
 */
export async function apiFetch<T>(
  path: string,
  opts?: RequestInit & { rawResponse?: boolean },
): Promise<T> {
  const token = await getApiToken();
  if (!API_URL) throw new Error("HONO_API_URL not configured");
  const url = `${API_URL}${path}`;

  const res = await fetch(url, {
    ...opts,
    headers: {
      ...opts?.headers,
      Authorization: `Bearer ${token}`,
    },
    // Next.js ISR: no-store by default for real-time data
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      (body as { error?: string }).error ?? `API error ${res.status}`,
    );
  }

  const json = await res.json();

  // Hono routes wrap in { data }, but some return different shapes
  if (opts?.rawResponse) return json as T;
  return (json as { data: T }).data;
}

/**
 * apiFetch variant that returns { rows, total } for paginated endpoints.
 */
export async function apiFetchPaginated<T>(
  path: string,
): Promise<{ rows: T[]; total: number }> {
  const result = await apiFetch<{ rows: T[]; total: number }>(path);
  return result;
}
