const { cors, runMiddleware, applySecurityHeaders } = require('../../../lib/cors');
const dbConnect = require('../../../lib/mongodb');
const School = require('../../../models/School');
const { serverError } = require('../../../lib/validate');

/**
 * GET /api/schools/slug/:slug — Retrieve a school by its URL slug.
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' },
        });
    }

    const { slug } = req.query;

    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: { code: 'INVALID_SLUG', message: 'A valid slug is required.' },
        });
    }

    try {
        await dbConnect();

        const school = await School.findOne({ slug: slug.trim() })
            .populate('adopters.userId', 'name');

        if (!school) {
            return res.status(404).json({
                success: false,
                error: { code: 'SCHOOL_NOT_FOUND', message: 'School not found.' },
            });
        }

        return res.status(200).json({ success: true, data: { school } });
    } catch (error) {
        return serverError(res, error, 'SCHOOL_BY_SLUG');
    }
}

module.exports = handler;
