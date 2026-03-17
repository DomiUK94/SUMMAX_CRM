"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeRedirectPath = sanitizeRedirectPath;
function sanitizeRedirectPath(value, fallback = "/dashboard/me") {
    const candidate = String(value ?? "").trim();
    if (!candidate.startsWith("/") || candidate.startsWith("//")) {
        return fallback;
    }
    return candidate;
}
