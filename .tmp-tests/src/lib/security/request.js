"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientIp = getClientIp;
exports.getRequestId = getRequestId;
exports.isTrustedOrigin = isTrustedOrigin;
exports.assertTrustedOrigin = assertTrustedOrigin;
exports.getServerActionContext = getServerActionContext;
const headers_1 = require("next/headers");
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
function getClientIp(input) {
    const forwardedFor = input.get("x-forwarded-for");
    if (forwardedFor) {
        const first = forwardedFor.split(",")[0]?.trim();
        if (first)
            return first;
    }
    const realIp = input.get("x-real-ip")?.trim();
    if (realIp)
        return realIp;
    return "unknown";
}
function getRequestId(input) {
    return input.get("x-request-id")?.trim() || crypto.randomUUID();
}
function isTrustedOrigin(request) {
    if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
        return true;
    }
    const origin = request.headers.get("origin");
    if (!origin)
        return false;
    const url = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
    const host = request.headers.get("host")?.trim();
    const allowedOrigins = new Set([url.origin]);
    if (forwardedHost) {
        allowedOrigins.add(`${forwardedProto || url.protocol.replace(":", "")}://${forwardedHost}`);
    }
    if (host) {
        allowedOrigins.add(`${url.protocol}//${host}`);
    }
    return allowedOrigins.has(origin);
}
function assertTrustedOrigin(request) {
    if (!isTrustedOrigin(request)) {
        throw new Error("untrusted_origin");
    }
}
function getServerActionContext() {
    const headerStore = (0, headers_1.headers)();
    return {
        ip: getClientIp(headerStore),
        requestId: getRequestId(headerStore)
    };
}
