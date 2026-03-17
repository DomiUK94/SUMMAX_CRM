import assert from "node:assert/strict";
import { sanitizeRedirectPath } from "../src/lib/security/navigation";
import { consumeRateLimit } from "../src/lib/security/rate-limit";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("sanitizeRedirectPath keeps only same-origin relative paths", () => {
  assert.equal(sanitizeRedirectPath("/dashboard/me"), "/dashboard/me");
  assert.equal(sanitizeRedirectPath("/contacts?tab=mine"), "/contacts?tab=mine");
  assert.equal(sanitizeRedirectPath("https://evil.example.com"), "/dashboard/me");
  assert.equal(sanitizeRedirectPath("//evil.example.com"), "/dashboard/me");
  assert.equal(sanitizeRedirectPath("javascript:alert(1)"), "/dashboard/me");
});

run("consumeRateLimit blocks after the configured threshold", () => {
  const key = `test-${Date.now()}-${Math.random()}`;
  const first = consumeRateLimit({ key, limit: 2, windowMs: 60_000 });
  const second = consumeRateLimit({ key, limit: 2, windowMs: 60_000 });
  const third = consumeRateLimit({ key, limit: 2, windowMs: 60_000 });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
});

console.log("All security tests passed");
