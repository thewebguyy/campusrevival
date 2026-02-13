const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');

/**
 * POST /api/auth/logout — Clear authentication cookies.
 */
module.exports = async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' },
        });
    }

    // Clear cookies by setting expired dates
    const cookieOptions = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';

    res.setHeader('Set-Cookie', [
        `authToken=; ${cookieOptions}`,
        `refreshToken=; ${cookieOptions}`
    ]);

    return res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' },
    });
};
