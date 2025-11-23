const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Token blacklist (in production, use Redis or database)
const tokenBlacklist = new Set();

exports.protect = async (req, res, next) => {
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

    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked. Please login again.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      // Attach token to request for logout
      req.token = token;
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Token is invalid or expired'
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'Access denied. Admin only.'
    });
  }
};

// Function to add token to blacklist
exports.blacklistToken = (token) => {
  tokenBlacklist.add(token);
};

// Function to check if token is blacklisted
exports.isBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

// Optional: Clear old tokens periodically (tokens expire anyway)
exports.clearExpiredTokens = () => {
  // In production, implement proper cleanup
  console.log(`Token blacklist size: ${tokenBlacklist.size}`);
};