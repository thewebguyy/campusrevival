const { cors, runMiddleware } = require('../../lib/cors');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { universityEmail } = req.body;

        if (!universityEmail) {
            return res.status(400).json({ success: false, error: 'University email is required' });
        }

        const isAcademic = universityEmail.toLowerCase().endsWith('.ac.uk') ||
            universityEmail.toLowerCase().endsWith('.edu');

        if (!isAcademic) {
            return res.status(400).json({
                success: false,
                error: 'Verification requires a valid institutional email (.ac.uk or .edu)'
            });
        }

        req.user.isVerifiedLeader = true;
        req.user.universityEmail = universityEmail;
        await req.user.save();

        res.status(200).json({
            success: true,
            message: 'You are now a Verified Campus Leader!',
            user: req.user
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = withAuth(handler);
