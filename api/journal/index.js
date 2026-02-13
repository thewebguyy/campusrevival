const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Journal = require('../../models/Journal');
const { withAuth } = require('../../lib/auth');
const { isValidObjectId, stripHtml, validationError, serverError } = require('../../lib/validate');
const { checkRateLimit } = require('../../lib/rateLimit');

/**
 * GET  /api/journal          — List current user's journal entries.
 * POST /api/journal          — Create a new journal entry.
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await dbConnect();

        // ── GET ────────────────────────────────────────────────
        if (req.method === 'GET') {
            return withAuth(async (innerReq, innerRes) => {
                try {
                    const { schoolId, limit = '50', page = '1' } = innerReq.query ?? {};
                    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
                    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

                    const query = { userId: innerReq.user._id };
                    if (schoolId && isValidObjectId(schoolId)) {
                        query.schoolId = schoolId;
                    }

                    const [entries, total] = await Promise.all([
                        Journal.find(query)
                            .populate('schoolId', 'name address')
                            .sort({ date: -1 })
                            .skip((pageNum - 1) * limitNum)
                            .limit(limitNum)
                            .lean(),
                        Journal.countDocuments(query),
                    ]);

                    return innerRes.status(200).json({
                        success: true,
                        data: { count: entries.length, total, page: pageNum, entries },
                    });
                } catch (error) {
                    return serverError(innerRes, error, 'JOURNAL_GET');
                }
            })(req, res);
        }

        // ── POST ───────────────────────────────────────────────
        if (req.method === 'POST') {
            return withAuth(async (innerReq, innerRes) => {
                // Rate limit: 20 journal entries per 15 min per user
                const rl = checkRateLimit(`journal:${innerReq.user._id}`, { max: 20 });
                if (!rl.allowed) {
                    return innerRes.status(429).json({
                        success: false,
                        error: {
                            code: 'RATE_LIMIT_EXCEEDED',
                            message: 'Too many journal entries. Please try again later.',
                        },
                    });
                }

                try {
                    const body = sanitizeInput({ ...innerReq.body });
                    let { entryText, schoolId, mediaUrl, mediaType } = body;

                    if (!entryText || typeof entryText !== 'string' || entryText.trim().length === 0) {
                        return validationError(
                            innerRes,
                            'MISSING_ENTRY_TEXT',
                            'Journal entry text is required.'
                        );
                    }

                    entryText = stripHtml(entryText.trim());
                    if (entryText.length > 5000) {
                        return validationError(
                            innerRes,
                            'ENTRY_TOO_LONG',
                            'Journal entry cannot exceed 5000 characters.'
                        );
                    }

                    if (schoolId && !isValidObjectId(schoolId)) {
                        return validationError(
                            innerRes,
                            'INVALID_SCHOOL_ID',
                            'The provided school ID is not valid.'
                        );
                    }

                    const validMediaTypes = ['image', 'audio', 'none'];
                    if (mediaType && !validMediaTypes.includes(mediaType)) {
                        mediaType = 'none';
                    }

                    const entry = await Journal.create({
                        userId: innerReq.user._id,
                        entryText,
                        schoolId: schoolId || null,
                        mediaUrl: mediaUrl || null,
                        mediaType: mediaType || 'none',
                    });

                    await innerReq.user.updateStreak();
                    await entry.populate('schoolId', 'name');

                    return innerRes.status(201).json({
                        success: true,
                        data: { message: 'Journal entry created', entry },
                    });
                } catch (error) {
                    return serverError(innerRes, error, 'JOURNAL_POST');
                }
            })(req, res);
        }

        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: `${req.method} is not allowed` },
        });
    } catch (error) {
        return serverError(res, error, 'JOURNAL_INDEX');
    }
}

module.exports = handler;
