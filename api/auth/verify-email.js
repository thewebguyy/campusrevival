const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const User = require('../../models/User');
const { serverError } = require('../../lib/validate');
const crypto = require('crypto');

/**
 * GET /api/auth/verify-email?token=xxx
 * Verifies user email using a token.
 */
async function handler(req, res) {
    await runMiddleware(req, res, cors);
    applySecurityHeaders(res);

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' },
        });
    }

    const { token } = req.query;

    if (!token || typeof token !== 'string' || token.length < 20) {
        return res.status(400).json({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'A valid verification token is required.' },
        });
    }

    try {
        await dbConnect();

        // Hash the token to compare against stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'TOKEN_INVALID_OR_EXPIRED',
                    message: 'Verification token is invalid or has expired. Please request a new one.',
                },
            });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        return res.status(200).json({
            success: true,
            data: {
                message: 'Email verified successfully! You can now access all features.',
            },
        });
    } catch (error) {
        return serverError(res, error, 'VERIFY_EMAIL');
    }
}

module.exports = handler;
