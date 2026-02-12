const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const School = require('../../models/School');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    const { id } = req.query;

    if (req.method === 'GET') {
        try {
            const school = await School.findById(id)
                .populate('adopters.userId', 'name email');

            if (!school) {
                return res.status(404).json({ success: false, error: 'School not found' });
            }

            return res.status(200).json({
                success: true,
                school: {
                    id: school._id,
                    name: school.name,
                    address: school.address
                },
                adopters: school.adopters,
                totalAdopters: school.adopters.length,
                adoptionCount: school.adoptionCount
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
