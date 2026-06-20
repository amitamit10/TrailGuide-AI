import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/$/, "");

/** Returns true when the Go backend is configured. */
export function hasBackend(): boolean {
  return !!BACKEND_URL;
}

/**
 * Forward a JSON body to the Go backend (which proxies it to the Python AI service).
 * Returns null if BACKEND_URL is not set or the backend is unreachable,
 * so callers can fall through to the direct Groq path.
 */
export async function proxyToBackend(
  path: string,
  body: unknown,
  accessToken: string,
  method = "POST"
): Promise<NextResponse | null> {
  if (!BACKEND_URL) return null;

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: method !== "GET" ? JSON.stringify(body) : undefined,
      // Inherit the 60 s maxDuration budget from the parent route
      signal: AbortSignal.timeout(55_000),
    });

    const contentType = res.headers.get("content-type") ?? "application/json";
    const resBody = await res.text();

    return new NextResponse(resBody, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    console.warn("[backend-proxy] unreachable, falling through to direct AI:", err);
    return null;
  }
}
