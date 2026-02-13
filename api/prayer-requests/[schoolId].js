const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const PrayerRequest = require('../../models/PrayerRequest');
const { isValidObjectId, serverError } = require('../../lib/validate');

/**
 * GET /api/prayer-requests/:schoolId — List prayer requests for a school.
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

    const { schoolId } = req.query;

    if (!isValidObjectId(schoolId)) {
        return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ID', message: 'The provided school ID is not valid.' },
        });
    }

    try {
        await dbConnect();

        const { page = '1', limit = '20' } = req.query;
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);

        const [requests, total] = await Promise.all([
            PrayerRequest.find({ schoolId })
                .populate('userId', 'name isVerifiedLeader organization')
                .sort({ isUrgent: -1, createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            PrayerRequest.countDocuments({ schoolId }),
        ]);

        return res.status(200).json({
            success: true,
            data: { count: requests.length, total, page: pageNum, requests },
        });
    } catch (error) {
        return serverError(res, error, 'PRAYER_BY_SCHOOL');
    }
}

module.exports = handler;
