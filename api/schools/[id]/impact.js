const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Adoption = require('../../models/Adoption');
const Journal = require('../../models/Journal');
const PrayerRequest = require('../../models/PrayerRequest');
const { isValidObjectId, serverError } = require('../../lib/validate');

/**
 * GET /api/schools/:id/impact — Monthly impact report for a school.
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

    const { id } = req.query;

    if (!isValidObjectId(id)) {
        return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ID', message: 'The provided school ID is not valid.' },
        });
    }

    try {
        await dbConnect();

        const startOfMonth = new Date();
        startOfMonth.setUTCDate(1);
        startOfMonth.setUTCHours(0, 0, 0, 0);

        const [adoptionsCount, journalCount, answeredPrayers] = await Promise.all([
            Adoption.countDocuments({ schoolId: id, dateAdopted: { $gte: startOfMonth } }),
            Journal.countDocuments({ schoolId: id, createdAt: { $gte: startOfMonth } }),
            PrayerRequest.find({
                schoolId: id,
                isAnswered: true,
                createdAt: { $gte: startOfMonth },
            })
                .select('answerNote')
                .lean(),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                report: {
                    month: startOfMonth.toLocaleString('default', {
                        month: 'long',
                        year: 'numeric',
                    }),
                    newAdoptions: adoptionsCount,
                    newJournals: journalCount,
                    answeredPrayers: answeredPrayers.length,
                    highlights: answeredPrayers
                        .map((r) => r.answerNote)
                        .filter(Boolean),
                },
            },
        });
    } catch (error) {
        return serverError(res, error, 'SCHOOL_IMPACT');
    }
}

module.exports = handler;
