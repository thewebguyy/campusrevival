const { cors, runMiddleware } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Adoption = require('../../models/Adoption');
const School = require('../../models/School');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
    await runMiddleware(req, res, cors);
    await dbConnect();

    if (req.method === 'GET') {
        return withAuth(async (req, res) => {
            try {
                const adoptions = await Adoption.find({ userId: req.user._id })
                    .populate('schoolId')
                    .sort({ dateAdopted: -1 });

                res.status(200).json({
                    success: true,
                    count: adoptions.length,
                    adoptions
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        })(req, res);
    }

    if (req.method === 'POST') {
        return withAuth(async (req, res) => {
            try {
                const { schoolId, adoptionType } = req.body;

                if (!schoolId) {
                    return res.status(400).json({ success: false, error: 'School ID is required' });
                }

                const validTypes = ['prayer', 'revival', 'both'];
                const type = adoptionType || 'prayer';
                if (!validTypes.includes(type)) {
                    return res.status(400).json({ success: false, error: 'Invalid adoption type' });
                }

                const school = await School.findById(schoolId);
                if (!school) {
                    return res.status(404).json({ success: false, error: 'School not found' });
                }

                if (school.isAdoptedByUser(req.user._id)) {
                    return res.status(400).json({ success: false, error: 'You have already adopted this school' });
                }

                const adoption = await Adoption.create({
                    userId: req.user._id,
                    schoolId,
                    adoptionType: type
                });

                await school.addAdopter(req.user._id, type);
                await req.user.updateStreak();
                await adoption.populate('schoolId');

                res.status(201).json({
                    success: true,
                    message: 'School adopted successfully',
                    adoption,
                    schoolStats: {
                        totalAdopters: school.adopters.length,
                        adoptionCount: school.adoptionCount
                    }
                });
            } catch (error) {
                if (error.code === 11000) {
                    return res.status(400).json({ success: false, error: 'You have already adopted this school' });
                }
                res.status(500).json({ success: false, error: error.message });
            }
        })(req, res);
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
}

module.exports = handler;
