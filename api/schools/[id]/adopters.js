const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const School = require('../../models/School');
const { isValidObjectId, serverError } = require('../../lib/validate');

/**
 * GET /api/schools/:id/adopters — List adopters for a given school.
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' },
        });
    }

    const { id } = req.query;

    if (!isValidObjectId(id)) {
        return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ID', message: 'The provided school ID is not valid.' },
        });
    }

    try {
        await dbConnect();

        const school = await School.findById(id)
            .populate('adopters.userId', 'name');

        if (!school) {
            return res.status(404).json({
                success: false,
                error: { code: 'SCHOOL_NOT_FOUND', message: 'School not found.' },
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                school: { id: school._id, name: school.name, address: school.address },
                adopters: school.adopters,
                totalAdopters: school.adopters.length,
                adoptionCount: school.adoptionCount,
            },
        });
    } catch (error) {
        return serverError(res, error, 'SCHOOL_ADOPTERS');
    }
}

module.exports = handler;
