import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/investors",
  "/contacts",
  "/imports",
  "/exports",
  "/admin",
  "/archivos",
  "/sugerencias",
  "/search",
  "/reporte-financiacion",
  "/mi-cuenta",
  "/usuarios",
  "/acuerdos",
  "/actividades",
  "/api"
];

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const RATE_LIMIT_RULES: Array<{ pathname: string; methods: string[]; limit: number; windowMs: number }> = [
  { pathname: "/login", methods: ["POST"], limit: 5, windowMs: 10 * 60 * 1000 },
  { pathname: "/api/search", methods: ["GET"], limit: 60, windowMs: 60 * 1000 },
  { pathname: "/api/imports", methods: ["POST"], limit: 6, windowMs: 10 * 60 * 1000 },
  { pathname: "/api/imports/status", methods: ["GET"], limit: 60, windowMs: 60 * 1000 },
  { pathname: "/api/exports/csv", methods: ["GET"], limit: 10, windowMs: 10 * 60 * 1000 },
  { pathname: "/api/contacts/", methods: ["PATCH"], limit: 60, windowMs: 10 * 60 * 1000 },
  { pathname: "/api/contacts/merge", methods: ["POST"], limit: 10, windowMs: 10 * 60 * 1000 },
  { pathname: "/api/contacts/assign-owner", methods: ["POST"], limit: 30, windowMs: 10 * 60 * 1000 }
];

type SupabaseCookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

function isTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const allowedOrigins = new Set<string>([request.nextUrl.origin]);
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  const host = request.headers.get("host")?.trim();

  if (forwardedHost) {
    allowedOrigins.add(`${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${forwardedHost}`);
  }
  if (host) {
    allowedOrigins.add(`${request.nextUrl.protocol}//${host}`);
  }

  return allowedOrigins.has(origin);
}

function findRateLimitRule(pathname: string, method: string) {
  return RATE_LIMIT_RULES.find((rule) => pathname.startsWith(rule.pathname) && rule.methods.includes(method));
}

async function hasValidSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: SupabaseCookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  return Boolean(user);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();
  const response = NextResponse.next();

  const rateLimitRule = findRateLimitRule(pathname, method);
  if (rateLimitRule) {
    const ip = getClientIp(request.headers);
    const result = consumeRateLimit({
      key: `${pathname}:${method}:${ip}`,
      limit: rateLimitRule.limit,
      windowMs: rateLimitRule.windowMs
    });
    if (!result.allowed) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "rate_limited" },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1))
            }
          }
        )
      );
    }
  }

  if (MUTATING_METHODS.has(method) && pathname !== "/api/health" && !isTrustedOrigin(request)) {
    return applySecurityHeaders(NextResponse.json({ error: "invalid_origin" }, { status: 403 }));
  }

  if (isProtectedPath(pathname)) {
    const isAuthenticated = await hasValidSession(request, response);
    if (!isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return applySecurityHeaders(NextResponse.redirect(url));
    }
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
