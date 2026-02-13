/**
 * @module lib/rateLimit
 * Simple in-memory rate limiter for Vercel serverless functions.
 *
 * ⚠️  This uses process-level memory, which is per-container in
 *     serverless.  It provides basic protection against bursts but
 *     is NOT a substitute for a distributed rate limiter (e.g.
 *     Vercel KV, Upstash Redis) if you need strict enforcement.
 */

/** @type {Map<string, { count: number, resetAt: number }>} */
const store = new Map();

/** Default window in milliseconds — 15 minutes. */
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

/** Default max requests per window. */
const DEFAULT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 100;

/** Cleanup expired entries every 5 minutes. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer = null;

function startCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store) {
            if (now > entry.resetAt) {
                store.delete(key);
            }
        }
    }, CLEANUP_INTERVAL_MS);
    // Allow the process to exit even if the timer is pending.
    if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Check rate limit for a given identifier (usually IP).
 *
 * @param {string} identifier - Client IP or other key.
 * @param {{ windowMs?: number, max?: number }} [options]
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
function checkRateLimit(identifier, options = {}) {
    startCleanup();

    const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    const max = options.max ?? DEFAULT_MAX;
    const now = Date.now();

    let entry = store.get(identifier);

    if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        store.set(identifier, entry);
    }

    entry.count += 1;

    return {
        allowed: entry.count <= max,
        remaining: Math.max(0, max - entry.count),
        resetAt: entry.resetAt,
    };
}

/**
 * Express / Vercel middleware style rate limiter.
 * Sends 429 if rate exceeded.
 *
 * @param {{ windowMs?: number, max?: number }} [options]
 * @returns {(req, res, next) => void}
 */
function rateLimitMiddleware(options = {}) {
    return (req, res, next) => {
        const ip =
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.socket?.remoteAddress ||
            'unknown';

        const result = checkRateLimit(ip, options);

        res.setHeader('X-RateLimit-Remaining', String(result.remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

        if (!result.allowed) {
            return res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests. Please try again later.',
                    retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
                },
            });
        }

        if (typeof next === 'function') next();
    };
}

module.exports = { checkRateLimit, rateLimitMiddleware };
