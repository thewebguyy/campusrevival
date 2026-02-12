const { cors, runMiddleware } = require('../lib/cors');
const dbConnect = require('../lib/mongodb');

module.exports = async function handler(req, res) {
    // Run CORS
    await runMiddleware(req, res, cors);

    try {
        // Connect to DB (optional for health check, but good to verify)
        await dbConnect();

        res.status(200).json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'connected (serverless)'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
}
