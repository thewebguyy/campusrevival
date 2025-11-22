const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  entryText: {
    type: String,
    required: [true, 'Entry text is required'],
    trim: true,
    maxlength: 5000
  },
  date: {
    type: Date,
    default: Date.now
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
journalSchema.index({ userId: 1, date: -1 });

// Prevent duplicate model compilation
module.exports = mongoose.models.Journal || mongoose.model('Journal', journalSchema);