const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const PrayerRequest = require('../../models/PrayerRequest');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    if (req.method === 'POST') {
        return withAuth(async (req, res) => {
            try {
                const { schoolId, content, isUrgent, category } = req.body;

                const request = await PrayerRequest.create({
                    userId: req.user._id,
                    schoolId,
                    content,
                    isUrgent,
                    category
                });

                await request.populate('userId', 'name isVerifiedLeader organization');

                res.status(201).json({ success: true, request });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        })(req, res);
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
