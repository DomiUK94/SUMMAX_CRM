import { headers } from "next/headers";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getClientIp(input: Headers | Request["headers"]): string {
  const forwardedFor = input.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = input.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function getRequestId(input: Headers | Request["headers"]): string {
  return input.get("x-request-id")?.trim() || crypto.randomUUID();
}

export function isTrustedOrigin(request: Request): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  const host = request.headers.get("host")?.trim();

  const allowedOrigins = new Set<string>([url.origin]);
  if (forwardedHost) {
    allowedOrigins.add(`${forwardedProto || url.protocol.replace(":", "")}://${forwardedHost}`);
  }
  if (host) {
    allowedOrigins.add(`${url.protocol}//${host}`);
  }

  return allowedOrigins.has(origin);
}

export function assertTrustedOrigin(request: Request) {
  if (!isTrustedOrigin(request)) {
    throw new Error("untrusted_origin");
  }
}

export function getServerActionContext() {
  const headerStore = headers();
  return {
    ip: getClientIp(headerStore),
    requestId: getRequestId(headerStore)
  };
}
