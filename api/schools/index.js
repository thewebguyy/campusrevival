const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const School = require('../../models/School');
const { withAuth, adminOnly } = require('../../lib/auth');
const { stripHtml, serverError, validationError } = require('../../lib/validate');
const { checkRateLimit } = require('../../lib/rateLimit');

/**
 * GET  /api/schools          — List active schools (paginated).
 * POST /api/schools          — Create a school (admin only).
 * GET  /api/schools?search=  — Search schools by name/city.
 */
async function handler(req, res) {
    try {
        await runMiddleware(req, res, cors);
        applySecurityHeaders(res);
        await dbConnect();

        // ── GET ────────────────────────────────────────────────
        if (req.method === 'GET') {
            const { search, page = '1', limit = '100', status } = req.query ?? {};
            const pageNum = Math.max(parseInt(page, 10) || 1, 1);
            const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);

            let schools;
            let total;

            if (search && search.trim().length > 0) {
                schools = await School.search(search.trim(), {
                    limit: limitNum,
                    page: pageNum,
                    status: status || 'active',
                });
                total = schools.length; // approximate for search
            } else {
                const query = { status: status || 'active' };
                total = await School.countDocuments(query);
                schools = await School.find(query)
                    .select('name slug lat lng address city country adoptionCount status featured image stats')
                    .sort({ name: 1 })
                    .skip((pageNum - 1) * limitNum)
                    .limit(limitNum)
                    .lean();
            }

            return res.status(200).json({
                success: true,
                count: schools.length,
                total,
                page: pageNum,
                schools,
            });
        }

        // ── POST (admin only) ─────────────────────────────────
        if (req.method === 'POST') {
            return withAuth(
                adminOnly(async (innerReq, innerRes) => {
                    try {
                        const body = sanitizeInput({ ...innerReq.body });

                        // Basic required fields check
                        if (!body.name || !body.lat || !body.lng || !body.address) {
                            return validationError(
                                innerRes,
                                'MISSING_FIELDS',
                                'name, lat, lng, and address are required.'
                            );
                        }

                        body.name = stripHtml(body.name);
                        body.address = stripHtml(body.address);
                        if (body.description) body.description = stripHtml(body.description);

                        const school = await School.create(body);
                        return innerRes.status(201).json({
                            success: true,
                            data: { school },
                        });
                    } catch (error) {
                        if (error.code === 11000) {
                            return validationError(
                                innerRes,
                                'DUPLICATE_SCHOOL',
                                'A school with this name already exists.'
                            );
                        }
                        return serverError(innerRes, error, 'SCHOOLS_CREATE');
                    }
                })
            )(req, res);
        }

        // ── Unsupported method ────────────────────────────────
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: `${req.method} is not allowed` },
        });
    } catch (error) {
        return serverError(res, error, 'SCHOOLS_INDEX');
    }
}

module.exports = handler;
