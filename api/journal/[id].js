const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Journal = require('../../models/Journal');
const { withAuth } = require('../../lib/auth');
const { isValidObjectId, serverError } = require('../../lib/validate');

/**
 * DELETE /api/journal/:id — Delete one of the authenticated user's journal entries.
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'DELETE') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only DELETE is allowed' },
        });
    }

    const { id } = req.query;

    if (!isValidObjectId(id)) {
        return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ID', message: 'The provided entry ID is not valid.' },
        });
    }

    return withAuth(async (innerReq, innerRes) => {
        try {
            await dbConnect();

            const entry = await Journal.findOne({
                _id: id,
                userId: innerReq.user._id,
            });

            if (!entry) {
                return innerRes.status(404).json({
                    success: false,
                    error: { code: 'ENTRY_NOT_FOUND', message: 'Journal entry not found.' },
                });
            }

            await entry.deleteOne();

            return innerRes.status(200).json({
                success: true,
                data: { message: 'Journal entry deleted' },
            });
        } catch (error) {
            return serverError(innerRes, error, 'JOURNAL_DELETE');
        }
    })(req, res);
}

module.exports = handler;
