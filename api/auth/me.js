const { cors, runMiddleware } = require('../../lib/cors');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // User is attached by withAuth middleware
    res.status(200).json({
        success: true,
        user: req.user
    });
}

module.exports = withAuth(handler);
