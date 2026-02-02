const mongoose = require('mongoose');

const prayerRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    content: {
        type: String,
        required: [true, 'Prayer request content is required'],
        trim: true,
        maxlength: 1000
    },
    isUrgent: {
        type: Boolean,
        default: false
    },
    category: {
        type: String,
        enum: ['Exams', 'Outreach', 'Mental Health', 'Revival', 'Other'],
        default: 'Other'
    },
    isAnswered: {
        type: Boolean,
        default: false
    },
    answeredAt: Date,
    answerNote: String
}, {
    timestamps: true
});

prayerRequestSchema.index({ schoolId: 1, createdAt: -1 });

module.exports = mongoose.models.PrayerRequest || mongoose.model('PrayerRequest', prayerRequestSchema);
