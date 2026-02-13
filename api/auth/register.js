const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const User = require('../../models/User');
const { generateAccessToken, generateRefreshToken } = require('../../lib/auth');
const { isValidEmail, stripHtml, validationError, serverError } = require('../../lib/validate');
const { checkRateLimit } = require('../../lib/rateLimit');

/**
 * POST /api/auth/register — Create a new user account.
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

    // Rate limit: 5 registrations per 15 minutes per IP
    const ip =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        'unknown';
    const rl = checkRateLimit(`register:${ip}`, { max: 5 });
    if (!rl.allowed) {
        return res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many registration attempts. Please try again later.',
                retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
            },
        });
    }

    try {
        await dbConnect();
        const body = sanitizeInput({ ...req.body });
        const { email, password, name } = body;

        // ── Validation ─────────────────────────────────────
        if (!email || !isValidEmail(email)) {
            return validationError(res, 'INVALID_EMAIL', 'Please provide a valid email address.');
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            return validationError(
                res,
                'WEAK_PASSWORD',
                'Password must be at least 8 characters long.'
            );
        }
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return validationError(res, 'INVALID_NAME', 'Name must be at least 2 characters.');
        }

        const cleanName = stripHtml(name.trim());

        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'USER_EXISTS',
                    message: 'An account with this email already exists.',
                },
            });
        }

        const user = await User.create({
            email: email.toLowerCase().trim(),
            password,
            name: cleanName,
        });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        return res.status(201).json({
            success: true,
            data: {
                message: 'Account created successfully',
                token: accessToken,
                refreshToken,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                },
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'USER_EXISTS',
                    message: 'An account with this email already exists.',
                },
            });
        }
        return serverError(res, error, 'AUTH_REGISTER');
    }
};
