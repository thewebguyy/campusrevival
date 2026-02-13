const { cors, runMiddleware, applySecurityHeaders, sanitizeInput } = require('../../lib/cors');
const dbConnect = require('../../lib/mongodb');
const School = require('../../models/School');
const { withAuth } = require('../../lib/auth');
const { stripHtml, validationError, serverError } = require('../../lib/validate');
const { checkRateLimit } = require('../../lib/rateLimit');

/**
 * POST /api/schools/submit — Submit a new school (authenticated users).
 * Unlike the admin-only POST /api/schools, this creates schools with
 * status 'pending' that must be approved by an admin.
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

    return withAuth(async (innerReq, innerRes) => {
        // Rate limit: 5 submissions per hour per user
        const rl = checkRateLimit(`school-submit:${innerReq.user._id}`, {
            max: 5,
            windowMs: 60 * 60 * 1000, // 1 hour
        });
        if (!rl.allowed) {
            return innerRes.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many submissions. Please try again later.',
                },
            });
        }

        try {
            await dbConnect();

            const body = sanitizeInput({ ...innerReq.body });
            const { name, city, address, lat, lng, website, description, image } = body;

            // Validation
            if (!name || name.trim().length < 2) {
                return validationError(innerRes, 'INVALID_NAME', 'University name is required (min 2 characters).');
            }
            if (!city || city.trim().length === 0) {
                return validationError(innerRes, 'MISSING_CITY', 'City is required.');
            }
            if (!address || address.trim().length < 5) {
                return validationError(innerRes, 'INVALID_ADDRESS', 'Full address is required (min 5 characters).');
            }
            if (lat === undefined || isNaN(lat) || lat < -90 || lat > 90) {
                return validationError(innerRes, 'INVALID_LAT', 'Valid latitude required (-90 to 90).');
            }
            if (lng === undefined || isNaN(lng) || lng < -180 || lng > 180) {
                return validationError(innerRes, 'INVALID_LNG', 'Valid longitude required (-180 to 180).');
            }
            if (!description || description.trim().length < 10) {
                return validationError(innerRes, 'INVALID_DESCRIPTION', 'Description required (min 10 characters).');
            }

            // Validate image if provided (base64 data URL)
            let imageUrl = null;
            if (image) {
                if (typeof image === 'string' && image.startsWith('data:image/')) {
                    // Validate size — rough check: base64 is ~33% larger than binary
                    const sizeInBytes = Math.ceil((image.length - image.indexOf(',') - 1) * 0.75);
                    if (sizeInBytes > 5 * 1024 * 1024) {
                        return validationError(innerRes, 'IMAGE_TOO_LARGE', 'Image must be less than 5MB.');
                    }
                    imageUrl = image;
                } else if (typeof image === 'string' && image.startsWith('http')) {
                    imageUrl = image;
                }
            }

            // Website URL validation
            let cleanWebsite = null;
            if (website) {
                try {
                    const url = new URL(website);
                    cleanWebsite = url.href;
                } catch {
                    return validationError(innerRes, 'INVALID_WEBSITE', 'Please provide a valid URL.');
                }
            }

            const schoolData = {
                name: stripHtml(name.trim()),
                city: stripHtml(city.trim()),
                address: stripHtml(address.trim()),
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                description: stripHtml(description.trim()),
                website: cleanWebsite,
                image: imageUrl,
                status: 'pending', // Must be approved by admin
                submittedBy: innerReq.user._id,
            };

            const school = await School.create(schoolData);

            return innerRes.status(201).json({
                success: true,
                data: {
                    message: 'University submitted successfully! It will be reviewed by an admin.',
                    school: {
                        id: school._id,
                        name: school.name,
                        city: school.city,
                        status: school.status,
                    },
                },
            });
        } catch (error) {
            if (error.code === 11000) {
                return validationError(innerRes, 'DUPLICATE_SCHOOL', 'A school with this name already exists.');
            }
            return serverError(innerRes, error, 'SCHOOL_SUBMIT');
        }
    })(req, res);
}

module.exports = handler;
