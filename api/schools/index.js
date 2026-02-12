const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const School = require('../../models/School');
const { withAuth, adminOnly } = require('../../lib/auth');

async function handler(req, res) {
    try {
        await runMiddleware(req, res, cors);
        await dbConnect();

        if (req.method === 'GET') {
            const schools = await School.find()
                .populate('adopters.userId', 'name email')
                .sort({ name: 1 });

            return res.status(200).json({
                success: true,
                count: schools.length,
                schools
            });
        }

        if (req.method === 'POST') {
            // POST is admin only
            return withAuth(adminOnly(async (req, res) => {
                try {
                    const school = await School.create(req.body);
                    res.status(201).json({
                        success: true,
                        message: 'School created',
                        school
                    });
                } catch (error) {
                    res.status(500).json({ success: false, error: 'Failed to create school', message: error.message });
                }
            }))(req, res);
        }

        res.status(405).json({ success: false, error: 'Method not allowed' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = handler;
