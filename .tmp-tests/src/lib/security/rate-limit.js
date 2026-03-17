"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeRateLimit = consumeRateLimit;
const RATE_LIMIT_STORE_SYMBOL = Symbol.for("summax-crm.rate-limit-store");
function getStore() {
    const globalValue = globalThis;
    if (!globalValue[RATE_LIMIT_STORE_SYMBOL]) {
        globalValue[RATE_LIMIT_STORE_SYMBOL] = new Map();
    }
    return globalValue[RATE_LIMIT_STORE_SYMBOL];
}
function consumeRateLimit(config) {
    const now = Date.now();
    const store = getStore();
    const current = store.get(config.key);
    if (!current || current.resetAt <= now) {
        const next = {
            count: 1,
            resetAt: now + config.windowMs
        };
        store.set(config.key, next);
        return {
            allowed: true,
            remaining: Math.max(config.limit - 1, 0),
            resetAt: next.resetAt
        };
    }
    current.count += 1;
    store.set(config.key, current);
    return {
        allowed: current.count <= config.limit,
        remaining: Math.max(config.limit - current.count, 0),
        resetAt: current.resetAt
    };
}
