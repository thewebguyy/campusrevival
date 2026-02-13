const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Adoption = require('../../models/Adoption');
const Journal = require('../../models/Journal');
const { withAuth } = require('../../lib/auth');
const { serverError } = require('../../lib/validate');

/**
 * GET /api/dashboard — Aggregate dashboard data for the authenticated user.
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

    return withAuth(async (innerReq, innerRes) => {
        try {
            await dbConnect();

            const [adoptions, journalCount, recentJournals] = await Promise.all([
                Adoption.find({ userId: innerReq.user._id })
                    .populate('schoolId', 'name address lat lng description')
                    .sort({ dateAdopted: -1 })
                    .lean(),
                Journal.countDocuments({ userId: innerReq.user._id }),
                Journal.find({ userId: innerReq.user._id })
                    .populate('schoolId', 'name')
                    .sort({ date: -1 })
                    .limit(5)
                    .lean(),
            ]);

            const totalPrayers = adoptions.reduce(
                (sum, a) => sum + (a.prayerCount ?? 0),
                0
            );
            const totalJournalEntries = adoptions.reduce(
                (sum, a) => sum + (a.journalEntries?.length ?? 0),
                0
            );

            const adoptedSchools = adoptions.map((a) => ({
                id: a.schoolId?._id,
                name: a.schoolId?.name ?? 'Unknown',
                address: a.schoolId?.address ?? '',
                dateAdopted: a.dateAdopted,
                prayerCount: a.prayerCount ?? 0,
                journalEntries: a.journalEntries?.length ?? 0,
                latestJournal:
                    a.journalEntries?.length > 0
                        ? a.journalEntries[a.journalEntries.length - 1]
                        : null,
            }));

            const daysActive = Math.max(
                0,
                Math.floor(
                    (Date.now() - new Date(innerReq.user.createdAt).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
            );

            return innerRes.status(200).json({
                success: true,
                data: {
                    dashboard: {
                        user: {
                            name: innerReq.user.name,
                            email: innerReq.user.email,
                            role: innerReq.user.role,
                            memberSince: innerReq.user.createdAt,
                            isVerifiedLeader: innerReq.user.isVerifiedLeader,
                        },
                        stats: {
                            schoolsCount: adoptions.length,
                            totalPrayers,
                            journalCount,
                            totalJournalEntries,
                            streakCount: innerReq.user.streakCount ?? 0,
                            daysActive,
                        },
                        adoptions: adoptedSchools,
                        recentJournals,
                    },
                },
            });
        } catch (error) {
            return serverError(innerRes, error, 'DASHBOARD');
        }
    })(req, res);
}

module.exports = handler;
