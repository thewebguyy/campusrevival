const Cors = require('cors');

/**
 * Build the list of allowed origins from the CORS_ORIGIN env var.
 * Supports comma-separated values:
 *   CORS_ORIGIN=https://campus-revival.vercel.app,http://localhost:3000
 *
 * Falls back to same-origin (no external origins) if unset.
 */
function getAllowedOrigins() {
    const raw = process.env.CORS_ORIGIN;
    if (!raw || raw === '*') {
        // In production this should always be explicitly set.
        // '*' is kept only for early development convenience.
        return raw || false;
    }
    return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

const cors = Cors({
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    origin: allowedOrigins,
    credentials: true,
    maxAge: 86400, // 24 h preflight cache
});

/**
 * Runs a Connect-style middleware as a promise (for Vercel serverless).
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {Function} fn - Connect/Express-compatible middleware.
 * @returns {Promise<void>}
 */
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

/**
 * Applies security headers that would normally come from helmet
 * but aren't available in raw serverless handlers.
 *
 * @param {import('http').ServerResponse} res
 */
function applySecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
    );
}

/**
 * Basic NoSQL injection protection — strips keys starting with "$" or
 * containing "." from plain objects/arrays (recursive).
 * Mutates the input in place and returns it.
 *
 * @param {*} obj
 * @returns {*}
 */
function sanitizeInput(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
            obj[idx] = sanitizeInput(item);
        });
        return obj;
    }

    for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
            delete obj[key];
        } else {
            obj[key] = sanitizeInput(obj[key]);
        }
    }
    return obj;
}

module.exports = { cors, runMiddleware, applySecurityHeaders, sanitizeInput };
