"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const navigation_1 = require("../src/lib/security/navigation");
const rate_limit_1 = require("../src/lib/security/rate-limit");
function run(name, fn) {
    try {
        fn();
        console.log(`PASS ${name}`);
    }
    catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}
run("sanitizeRedirectPath keeps only same-origin relative paths", () => {
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("/dashboard/me"), "/dashboard/me");
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("/contacts?tab=mine"), "/contacts?tab=mine");
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("https://evil.example.com"), "/dashboard/me");
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("//evil.example.com"), "/dashboard/me");
    strict_1.default.equal((0, navigation_1.sanitizeRedirectPath)("javascript:alert(1)"), "/dashboard/me");
});
run("consumeRateLimit blocks after the configured threshold", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const first = (0, rate_limit_1.consumeRateLimit)({ key, limit: 2, windowMs: 60_000 });
    const second = (0, rate_limit_1.consumeRateLimit)({ key, limit: 2, windowMs: 60_000 });
    const third = (0, rate_limit_1.consumeRateLimit)({ key, limit: 2, windowMs: 60_000 });
    strict_1.default.equal(first.allowed, true);
    strict_1.default.equal(second.allowed, true);
    strict_1.default.equal(third.allowed, false);
});
console.log("All security tests passed");
