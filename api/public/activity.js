const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Adoption = require('../../models/Adoption');
const { serverError } = require('../../lib/validate');

/**
 * GET /api/public/activity — Recent public adoption activity feed.
 * No authentication required.
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

    try {
        await dbConnect();

        // Cache-friendly: set a short cache header for public data
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

        const adoptions = await Adoption.find()
            .populate('userId', 'name')
            .populate('schoolId', 'name city')
            .sort({ dateAdopted: -1 })
            .limit(10)
            .lean();

        const activity = adoptions.map((a) => ({
            userName: a.userId?.name ?? 'Someone',
            schoolName: a.schoolId?.name ?? 'a university',
            city: a.schoolId?.city ?? 'the UK',
            type: a.adoptionType,
            time: a.dateAdopted,
        }));

        return res.status(200).json({ success: true, data: { activity } });
    } catch (error) {
        return serverError(res, error, 'PUBLIC_ACTIVITY');
    }
}

module.exports = handler;
