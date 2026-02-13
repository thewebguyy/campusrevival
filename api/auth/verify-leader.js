const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../../lib/cors');
const { withAuth } = require('../../lib/auth');
const { isValidEmail, validationError, serverError } = require('../../lib/validate');

/** Valid academic email domain suffixes. */
const ACADEMIC_DOMAINS = ['.ac.uk', '.edu', '.edu.au', '.ac.in', '.edu.ng'];

/**
 * POST /api/auth/verify-leader
 * Verifies that the user has an institutional email address and marks
 * them as a verified campus leader.
 *
 * NOTE: This is a simplified check. A production system should send
 * a confirmation email with a verification link/code.
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' },
        });
    }

    try {
        const body = sanitizeInput({ ...req.body });
        const { universityEmail } = body;

        if (!universityEmail || !isValidEmail(universityEmail)) {
            return validationError(
                res,
                'INVALID_EMAIL',
                'A valid university email address is required.'
            );
        }

        const emailLower = universityEmail.toLowerCase().trim();
        const isAcademic = ACADEMIC_DOMAINS.some((domain) =>
            emailLower.endsWith(domain)
        );

        if (!isAcademic) {
            return validationError(
                res,
                'NON_ACADEMIC_EMAIL',
                `Verification requires an institutional email ending in one of: ${ACADEMIC_DOMAINS.join(', ')}`
            );
        }

        // TODO: In production, send a verification email with a one-time code
        // instead of auto-verifying here.
        req.user.isVerifiedLeader = true;
        req.user.universityEmail = emailLower;
        await req.user.save();

        return res.status(200).json({
            success: true,
            data: {
                message: 'You are now a Verified Campus Leader!',
                user: req.user,
            },
        });
    } catch (error) {
        return serverError(res, error, 'AUTH_VERIFY_LEADER');
    }
}

module.exports = withAuth(handler);
