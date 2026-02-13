/**
 * @module lib/validate
 * Shared server-side validation & sanitisation helpers.
 */

/**
 * Strip HTML tags from a string to prevent XSS.
 *
 * @param {string} str
 * @returns {string} Sanitised string.
 */
function stripHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
}

/**
 * Validate an email address format.
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate a MongoDB ObjectId string.
 *
 * @param {string} id
 * @returns {boolean}
 */
function isValidObjectId(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * Return a 400 response with a consistent error envelope.
 *
 * @param {import('http').ServerResponse} res
 * @param {string} code   - Machine-readable error code.
 * @param {string} message - Human-readable message.
 * @param {object} [details] - Optional extra context.
 */
function validationError(res, code, message, details) {
    return res.status(400).json({
        success: false,
        error: { code, message, ...(details ? { details } : {}) },
    });
}

/**
 * Return a 500 response with a consistent error envelope.
 *
 * @param {import('http').ServerResponse} res
 * @param {Error} error
 * @param {string} [context] - Where the error occurred.
 */
function serverError(res, error, context = 'UNKNOWN') {
    console.error(`[${context}]`, error);
    return res.status(500).json({
        success: false,
        error: {
            code: 'SERVER_ERROR',
            message:
                process.env.NODE_ENV === 'production'
                    ? 'An unexpected error occurred. Please try again later.'
                    : error.message,
        },
    });
}

module.exports = {
    stripHtml,
    isValidEmail,
    isValidObjectId,
    validationError,
    serverError,
};
