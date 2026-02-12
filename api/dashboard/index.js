const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Adoption = require('../../models/Adoption');
const Journal = require('../../models/Journal');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    if (req.method === 'GET') {
        return withAuth(async (req, res) => {
            try {
                const adoptions = await Adoption.find({ userId: req.user._id })
                    .populate('schoolId', 'name address lat lng description')
                    .sort({ dateAdopted: -1 })
                    .lean();

                const totalPrayers = adoptions.reduce((sum, adoption) => sum + adoption.prayerCount, 0);
                const journalCount = await Journal.countDocuments({ userId: req.user._id });
                const totalJournalEntries = adoptions.reduce(
                    (sum, adoption) => sum + (adoption.journalEntries?.length || 0),
                    0
                );

                const schoolsCount = adoptions.length;
                const adoptedSchools = adoptions.map(a => ({
                    id: a.schoolId._id,
                    name: a.schoolId.name,
                    address: a.schoolId.address,
                    dateAdopted: a.dateAdopted,
                    prayerCount: a.prayerCount,
                    journalEntries: a.journalEntries?.length || 0,
                    latestJournal: a.journalEntries && a.journalEntries.length > 0 ? a.journalEntries[a.journalEntries.length - 1] : null
                }));

                const recentJournals = await Journal.find({ userId: req.user._id })
                    .populate('schoolId', 'name')
                    .sort({ date: -1 })
                    .limit(5)
                    .lean();

                res.status(200).json({
                    success: true,
                    dashboard: {
                        user: {
                            name: req.user.name,
                            email: req.user.email,
                            role: req.user.role,
                            memberSince: req.user.createdAt,
                            isVerifiedLeader: req.user.isVerifiedLeader
                        },
                        stats: {
                            schoolsCount,
                            totalPrayers,
                            journalCount,
                            totalJournalEntries,
                            streakCount: req.user.streakCount || 0,
                            daysActive: Math.floor((Date.now() - new Date(req.user.createdAt)) / (1000 * 60 * 60 * 24))
                        },
                        adoptions: adoptedSchools,
                        recentJournals
                    }
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        })(req, res);
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
