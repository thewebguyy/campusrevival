const cloudinary = require('cloudinary').v2;

// Configure with environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a media file to Cloudinary
 * @param {string} file - Base64 string or file path
 * @param {string} folder - Folder name in Cloudinary
 */
const uploadMedia = async (file, folder = 'crm_journals') => {
    try {
        const result = await cloudinary.uploader.upload(file, {
            folder,
            resource_type: 'auto'
        });
        return {
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format
        };
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        throw new Error('Failed to upload media to cloud storage');
    }
};

module.exports = { uploadMedia };
