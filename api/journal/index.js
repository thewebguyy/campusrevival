const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Journal = require('../../models/Journal');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    if (req.method === 'GET') {
        return withAuth(async (req, res) => {
            try {
                const { schoolId, limit = 50 } = req.query;
                const query = { userId: req.user._id };
                if (schoolId) query.schoolId = schoolId;

                const entries = await Journal.find(query)
                    .populate('schoolId', 'name address')
                    .sort({ date: -1 })
                    .limit(parseInt(limit));

                res.status(200).json({ success: true, count: entries.length, entries });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        })(req, res);
    }

    if (req.method === 'POST') {
        return withAuth(async (req, res) => {
            try {
                const { entryText, schoolId, mediaUrl, mediaType } = req.body;
                if (!entryText || entryText.trim().length === 0) {
                    return res.status(400).json({ success: false, error: 'Journal entry text is required' });
                }

                const entry = await Journal.create({
                    userId: req.user._id,
                    entryText: entryText.trim(),
                    schoolId: schoolId || null,
                    mediaUrl: mediaUrl || null,
                    mediaType: mediaType || 'none'
                });

                await req.user.updateStreak();
                await entry.populate('schoolId', 'name');

                res.status(201).json({ success: true, message: 'Journal entry created', entry });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        })(req, res);
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
