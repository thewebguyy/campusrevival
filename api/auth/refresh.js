const { cors, runMiddleware, applySecurityHeaders } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const { generateAccessToken } = require('../../lib/auth');
const { serverError } = require('../../lib/validate');

/**
 * POST /api/auth/refresh — Exchange a valid refresh token for a new access token.
 */
module.exports = async function handler(req, res) {
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
        const { refreshToken } = req.body ?? {};

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_REFRESH_TOKEN', message: 'Refresh token is required.' },
            });
        }

        const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, secret);
        } catch (jwtError) {
            const code =
                jwtError.name === 'TokenExpiredError'
                    ? 'REFRESH_TOKEN_EXPIRED'
                    : 'REFRESH_TOKEN_INVALID';
            return res.status(401).json({
                success: false,
                error: {
                    code,
                    message: 'Invalid or expired refresh token. Please log in again.',
                },
            });
        }

        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_TOKEN_TYPE', message: 'This is not a refresh token.' },
            });
        }

        await dbConnect();
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
            });
        }

        const newAccessToken = generateAccessToken(user);

        return res.status(200).json({
            success: true,
            data: {
                token: newAccessToken,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isVerifiedLeader: user.isVerifiedLeader,
                },
            },
        });
    } catch (error) {
        return serverError(res, error, 'AUTH_REFRESH');
    }
};
