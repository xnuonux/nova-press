import type { NextRequest } from "next/server";

/**
 * best-effort client ip for the anonymous, rate-limited subscribe-lifecycle
 * routes. reads x-forwarded-for (first hop) then x-real-ip, falling back to
 * "unknown". one source of truth, so proxy-depth / trusted-hop changes land in
 * exactly one place instead of three copies.
 */
export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  const first = fwd ? fwd.split(",")[0]?.trim() : "";
  return first || request.headers.get("x-real-ip") || "unknown";
}
