const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');
const { withAuth } = require('../../lib/auth');

/**
 * GET /api/auth/me — Return the currently authenticated user's profile.
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' },
        });
    }

    return res.status(200).json({
        success: true,
        data: { user: req.user },
    });
}

module.exports = withAuth(handler);
