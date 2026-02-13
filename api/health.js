const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../lib/cors');
const dbConnect = require('../lib/mongodb');

/**
 * GET /api/health
 * Returns service health status including DB connectivity.
 */
module.exports = async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' },
        });
    }

    try {
        await dbConnect();
        return res.status(200).json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
        });
    } catch (error) {
        return res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: {
                code: 'DB_CONNECTION_ERROR',
                message: 'Database is unreachable. Please try again later.',
            },
        });
    }
};
