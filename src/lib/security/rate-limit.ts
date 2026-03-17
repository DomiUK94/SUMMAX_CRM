type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_STORE_SYMBOL = Symbol.for("summax-crm.rate-limit-store");

function getStore(): Map<string, RateLimitEntry> {
  const globalValue = globalThis as typeof globalThis & {
    [RATE_LIMIT_STORE_SYMBOL]?: Map<string, RateLimitEntry>;
  };

  if (!globalValue[RATE_LIMIT_STORE_SYMBOL]) {
    globalValue[RATE_LIMIT_STORE_SYMBOL] = new Map<string, RateLimitEntry>();
  }

  return globalValue[RATE_LIMIT_STORE_SYMBOL]!;
}

export function consumeRateLimit(config: RateLimitConfig) {
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
