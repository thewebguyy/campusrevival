const { cors, runMiddleware } = require('../../../lib/cors');
const dbConnect = require('../../../lib/mongodb');
const School = require('../../../models/School');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    const { slug } = req.query;

    if (req.method === 'GET') {
        try {
            const school = await School.findOne({ slug })
                .populate('adopters.userId', 'name email');

            if (!school) {
                return res.status(404).json({ success: false, error: 'School not found' });
            }

            return res.status(200).json({
                success: true,
                school
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
