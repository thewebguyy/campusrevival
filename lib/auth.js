const jwt = require('jsonwebtoken');
const User = require('../models/User');
const dbConnect = require('./mongodb');

/** Access token lifetime — keep short for security. */
const ACCESS_TOKEN_EXPIRY = '1h';

/** Refresh token lifetime. */
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate a signed JWT access token.
 *
 * @param {object} user - Mongoose user document.
 * @returns {string} Signed JWT.
 */
function generateAccessToken(user) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error(
            'JWT_SECRET must be defined and at least 32 characters long.'
        );
    }

    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
            name: user.name,
        },
        secret,
        { expiresIn: process.env.JWT_EXPIRE || ACCESS_TOKEN_EXPIRY }
    );
}

/**
 * Generate a refresh token with a longer lifetime.
 *
 * @param {object} user - Mongoose user document.
 * @returns {string} Signed JWT refresh token.
 */
function generateRefreshToken(user) {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    return jwt.sign(
        { id: user._id, type: 'refresh' },
        secret,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
}

/**
 * Higher-order function that wraps a serverless handler with authentication.
 * Verifies the JWT, connects to the DB, attaches `req.user`, then delegates
 * to the inner handler.  On failure returns a consistent error envelope.
 *
 * @param {Function} handler - `(req, res) => Promise<void>`
 * @returns {Function}
 */
const withAuth = (handler) => async (req, res) => {
    try {
        // ── Extract token ────────────────────────────────────
        let token;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        // Add cookie support
        if (!token && req.cookies?.authToken) {
            token = req.cookies.authToken;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_TOKEN_MISSING',
                    message: 'Authentication required. Please log in.',
                },
            });
        }

        // ── Verify token ─────────────────────────────────────
        const secret = process.env.JWT_SECRET;
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (jwtError) {
            const code =
                jwtError.name === 'TokenExpiredError'
                    ? 'AUTH_TOKEN_EXPIRED'
                    : 'AUTH_TOKEN_INVALID';
            const message =
                jwtError.name === 'TokenExpiredError'
                    ? 'Your session has expired. Please log in again.'
                    : 'Invalid authentication token. Please log in again.';

            return res.status(401).json({
                success: false,
                error: { code, message },
            });
        }

        // ── Resolve user ─────────────────────────────────────
        await dbConnect();
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_USER_NOT_FOUND',
                    message: 'Account not found. It may have been deleted.',
                },
            });
        }

        req.user = user;
        req.token = token;

        return handler(req, res);
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'AUTH_INTERNAL_ERROR',
                message: 'An internal authentication error occurred.',
            },
        });
    }
};

/**
 * Admin-only guard — must be used inside `withAuth`:
 *   `withAuth(adminOnly(handler))`
 *
 * @param {Function} handler
 * @returns {Function}
 */
const adminOnly = (handler) => async (req, res) => {
    if (req.user?.role === 'admin') {
        return handler(req, res);
    }
    return res.status(403).json({
        success: false,
        error: {
            code: 'AUTH_ADMIN_REQUIRED',
            message: 'This action requires admin privileges.',
        },
    });
};

module.exports = {
    withAuth,
    adminOnly,
    generateAccessToken,
    generateRefreshToken,
};
