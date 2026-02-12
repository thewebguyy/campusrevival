const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Adoption = require('../../models/Adoption');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    if (req.method === 'GET') {
        try {
            const adoptions = await Adoption.find()
                .populate('userId', 'name')
                .populate('schoolId', 'name city')
                .sort({ dateAdopted: -1 })
                .limit(10);

            const activity = adoptions.map(a => ({
                userName: a.userId?.name || 'Someone',
                schoolName: a.schoolId?.name || 'a university',
                city: a.schoolId?.city || 'the UK',
                type: a.adoptionType,
                time: a.dateAdopted
            }));

            return res.status(200).json({ success: true, activity });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
