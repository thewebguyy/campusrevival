const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Adoption = require('../../models/Adoption');
const Journal = require('../../models/Journal');
const PrayerRequest = require('../../models/PrayerRequest');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    const { id } = req.query;

    if (req.method === 'GET') {
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const [adoptionsCount, journalCount, prayerRequests] = await Promise.all([
                Adoption.countDocuments({ schoolId: id, dateAdopted: { $gte: startOfMonth } }),
                Journal.countDocuments({ schoolId: id, createdAt: { $gte: startOfMonth } }),
                PrayerRequest.find({ schoolId: id, isAnswered: true, createdAt: { $gte: startOfMonth } })
            ]);

            return res.status(200).json({
                success: true,
                report: {
                    month: startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
                    newAdoptions: adoptionsCount,
                    newJournals: journalCount,
                    answeredPrayers: prayerRequests.length,
                    highlights: prayerRequests.map(r => r.answerNote).filter(Boolean)
                }
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
