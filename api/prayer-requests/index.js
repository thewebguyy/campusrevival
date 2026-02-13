const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const PrayerRequest = require('../../models/PrayerRequest');
const { withAuth } = require('../../lib/auth');
const { isValidObjectId, stripHtml, validationError, serverError } = require('../../lib/validate');
const { checkRateLimit } = require('../../lib/rateLimit');

/**
 * POST /api/prayer-requests — Create a new prayer request.
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' },
        });
    }

    return withAuth(async (innerReq, innerRes) => {
        // Rate limit: 10 prayer requests per 15 min per user
        const rl = checkRateLimit(`prayer:${innerReq.user._id}`, { max: 10 });
        if (!rl.allowed) {
            return innerRes.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many prayer requests. Please try again later.',
                },
            });
        }

        try {
            await dbConnect();

            const body = sanitizeInput({ ...innerReq.body });
            const { schoolId, content, isUrgent, category } = body;

            if (!schoolId || !isValidObjectId(schoolId)) {
                return validationError(
                    innerRes,
                    'INVALID_SCHOOL_ID',
                    'A valid school ID is required.'
                );
            }
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                return validationError(
                    innerRes,
                    'MISSING_CONTENT',
                    'Prayer request content is required.'
                );
            }

            const cleanContent = stripHtml(content.trim());
            if (cleanContent.length > 1000) {
                return validationError(
                    innerRes,
                    'CONTENT_TOO_LONG',
                    'Prayer request content cannot exceed 1000 characters.'
                );
            }

            const validCategories = ['Exams', 'Outreach', 'Mental Health', 'Revival', 'Other'];
            const safeCategory = validCategories.includes(category) ? category : 'Other';

            const request = await PrayerRequest.create({
                userId: innerReq.user._id,
                schoolId,
                content: cleanContent,
                isUrgent: Boolean(isUrgent),
                category: safeCategory,
            });

            await request.populate('userId', 'name isVerifiedLeader organization');

            return innerRes.status(201).json({
                success: true,
                data: { request },
            });
        } catch (error) {
            return serverError(innerRes, error, 'PRAYER_CREATE');
        }
    })(req, res);
}

module.exports = handler;
