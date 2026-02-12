const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Updated path
const dbConnect = require('./mongodb');

/**
 * Middleware wrapper for protected routes
 */
const withAuth = (handler) => async (req, res) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized to access this route. Please login.'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ensure DB is connected
        await dbConnect();

        // Get user from token
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found. Please login again.'
            });
        }

        // Attach user to request
        req.user = user;
        req.token = token;

        return handler(req, res);
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token. Please login again.'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired. Please login again.'
            });
        }
        console.error('Auth Middleware Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

/**
 * Middleware wrapper for admin-only routes
 * Must be used inside withAuth: withAuth(adminOnly(handler))
 */
const adminOnly = (handler) => async (req, res) => {
    if (req.user && req.user.role === 'admin') {
        return handler(req, res);
    } else {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Admin privileges required.'
        });
    }
};

module.exports = { withAuth, adminOnly };
