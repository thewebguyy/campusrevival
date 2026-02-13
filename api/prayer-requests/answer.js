const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const PrayerRequest = require('../../models/PrayerRequest');
const { withAuth } = require('../../lib/auth');
const { isValidObjectId, stripHtml, validationError, serverError } = require('../../lib/validate');

/**
 * PATCH /api/prayer-requests/answer
 * Mark a prayer request as answered (by its creator or a verified leader).
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'PATCH') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only PATCH is allowed' },
        });
    }

    return withAuth(async (innerReq, innerRes) => {
        try {
            await dbConnect();

            const body = sanitizeInput({ ...innerReq.body });
            const { requestId, answerNote } = body;

            if (!requestId || !isValidObjectId(requestId)) {
                return validationError(
                    innerRes,
                    'INVALID_REQUEST_ID',
                    'A valid prayer request ID is required.'
                );
            }

            const prayerRequest = await PrayerRequest.findById(requestId);

            if (!prayerRequest) {
                return innerRes.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Prayer request not found.' },
                });
            }

            // Only the creator or a verified leader can mark as answered
            const isOwner = prayerRequest.userId.toString() === innerReq.user._id.toString();
            const isLeader = innerReq.user.isVerifiedLeader;

            if (!isOwner && !isLeader) {
                return innerRes.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Only the prayer request author or a verified leader can mark this as answered.',
                    },
                });
            }

            prayerRequest.isAnswered = true;
            prayerRequest.answeredAt = new Date();
            if (answerNote) {
                prayerRequest.answerNote = stripHtml(answerNote.trim()).substring(0, 500);
            }

            await prayerRequest.save();
            await prayerRequest.populate('userId', 'name isVerifiedLeader');

            return innerRes.status(200).json({
                success: true,
                data: {
                    message: 'Prayer request marked as answered! Praise God!',
                    request: prayerRequest,
                },
            });
        } catch (error) {
            return serverError(innerRes, error, 'PRAYER_ANSWER');
        }
    })(req, res);
}

module.exports = handler;
