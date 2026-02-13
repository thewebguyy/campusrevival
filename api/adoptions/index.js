const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const Adoption = require('../../models/Adoption');
const School = require('../../models/School');
const { withAuth } = require('../../lib/auth');
const { isValidObjectId, validationError, serverError } = require('../../lib/validate');
const { checkRateLimit } = require('../../lib/rateLimit');

/**
 * GET  /api/adoptions — List current user's adoptions.
 * POST /api/adoptions — Adopt a school.
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await dbConnect();

        // ── GET — my adoptions ────────────────────────────────
        if (req.method === 'GET') {
            return withAuth(async (innerReq, innerRes) => {
                try {
                    const adoptions = await Adoption.find({ userId: innerReq.user._id })
                        .populate('schoolId', 'name address city lat lng')
                        .sort({ dateAdopted: -1 })
                        .lean();

                    return innerRes.status(200).json({
                        success: true,
                        data: { count: adoptions.length, adoptions },
                    });
                } catch (error) {
                    return serverError(innerRes, error, 'ADOPTIONS_GET');
                }
            })(req, res);
        }

        // ── POST — adopt a school ─────────────────────────────
        if (req.method === 'POST') {
            return withAuth(async (innerReq, innerRes) => {
                // Rate limit: 10 adoptions per 15 min per user
                const rl = checkRateLimit(`adopt:${innerReq.user._id}`, { max: 10 });
                if (!rl.allowed) {
                    return innerRes.status(429).json({
                        success: false,
                        error: {
                            code: 'RATE_LIMIT_EXCEEDED',
                            message: 'Too many adoption requests. Please try again later.',
                        },
                    });
                }

                try {
                    const body = sanitizeInput({ ...innerReq.body });
                    const { schoolId, adoptionType } = body;

                    if (!schoolId || !isValidObjectId(schoolId)) {
                        return validationError(
                            innerRes,
                            'INVALID_SCHOOL_ID',
                            'A valid school ID is required.'
                        );
                    }

                    const validTypes = ['prayer', 'revival', 'both'];
                    const type = adoptionType || 'prayer';
                    if (!validTypes.includes(type)) {
                        return validationError(
                            innerRes,
                            'INVALID_ADOPTION_TYPE',
                            `Adoption type must be one of: ${validTypes.join(', ')}`
                        );
                    }

                    const school = await School.findById(schoolId);
                    if (!school) {
                        return innerRes.status(404).json({
                            success: false,
                            error: { code: 'SCHOOL_NOT_FOUND', message: 'School not found.' },
                        });
                    }

                    if (school.isAdoptedByUser(innerReq.user._id)) {
                        return innerRes.status(409).json({
                            success: false,
                            error: {
                                code: 'ALREADY_ADOPTED',
                                message: 'You have already adopted this school.',
                            },
                        });
                    }

                    // Create both records — Adoption doc + School.adopters array
                    const adoption = await Adoption.create({
                        userId: innerReq.user._id,
                        schoolId,
                        adoptionType: type,
                    });

                    const updatedSchool = await school.addAdopter(innerReq.user._id, type);
                    await innerReq.user.updateStreak();
                    await adoption.populate('schoolId', 'name address city');

                    return innerRes.status(201).json({
                        success: true,
                        data: {
                            message: 'School adopted successfully!',
                            adoption,
                            schoolStats: {
                                totalAdopters: updatedSchool?.adopters?.length ?? school.adopters.length + 1,
                                adoptionCount: updatedSchool?.adoptionCount ?? school.adoptionCount + 1,
                            },
                        },
                    });
                } catch (error) {
                    if (error.code === 11000) {
                        return innerRes.status(409).json({
                            success: false,
                            error: {
                                code: 'ALREADY_ADOPTED',
                                message: 'You have already adopted this school.',
                            },
                        });
                    }
                    return serverError(innerRes, error, 'ADOPTIONS_POST');
                }
            })(req, res);
        }

        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: `${req.method} is not allowed` },
        });
    } catch (error) {
        return serverError(res, error, 'ADOPTIONS_INDEX');
    }
}

module.exports = handler;
