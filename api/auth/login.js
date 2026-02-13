const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const User = require('../../models/User');
const { generateAccessToken, generateRefreshToken } = require('../../lib/auth');
const { isValidEmail, validationError, serverError } = require('../../lib/validate');
const { checkRateLimit } = require('../../lib/rateLimit');

/**
 * POST /api/auth/login — Authenticate a user and return JWT tokens.
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

    // Rate limit: 10 login attempts per 15 minutes per IP
    const ip =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        'unknown';
    const rl = checkRateLimit(`login:${ip}`, { max: 10 });
    if (!rl.allowed) {
        return res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many login attempts. Please try again later.',
                retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
            },
        });
    }

    try {
        await dbConnect();
        const body = sanitizeInput({ ...req.body });
        const { email, password } = body;

        if (!email || !isValidEmail(email)) {
            return validationError(res, 'INVALID_EMAIL', 'Please provide a valid email address.');
        }
        if (!password || typeof password !== 'string') {
            return validationError(res, 'MISSING_PASSWORD', 'Password is required.');
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
            });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        return res.status(200).json({
            success: true,
            data: {
                message: 'Login successful',
                token: accessToken,
                refreshToken,
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
        return serverError(res, error, 'AUTH_LOGIN');
    }
};
