const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const PrayerRequest = require('../../models/PrayerRequest');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    const { schoolId } = req.query;

    if (req.method === 'GET') {
        try {
            const requests = await PrayerRequest.find({ schoolId })
                .populate('userId', 'name isVerifiedLeader organization')
                .sort({ createdAt: -1 })
                .limit(50);

            return res.status(200).json({ success: true, requests });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
