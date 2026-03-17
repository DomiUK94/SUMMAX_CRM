export function sanitizeRedirectPath(value: string | null | undefined, fallback = "/dashboard/me") {
  const candidate = String(value ?? "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}
