const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Journal = require('../../models/Journal');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    const { id } = req.query;

    if (req.method === 'DELETE') {
        return withAuth(async (req, res) => {
            try {
                const entry = await Journal.findOne({ _id: id, userId: req.user._id });
                if (!entry) {
                    return res.status(404).json({ success: false, error: 'Journal entry not found' });
                }
                await entry.deleteOne();
                res.status(200).json({ success: true, message: 'Journal entry deleted' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        })(req, res);
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
