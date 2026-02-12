const mongoose = require('mongoose');

const adoptionSchema = new mongoose.Schema({
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
  adoptionType: {
    type: String,
    enum: ['prayer', 'revival', 'both'],
    default: 'prayer',
    required: true
  },
  dateAdopted: {
    type: Date,
    default: Date.now
  },
  journalEntries: [{
    text: {
      type: String,
      required: true,
      maxlength: 5000
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  prayerCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Prevent duplicate adoptions
adoptionSchema.index({ userId: 1, schoolId: 1 }, { unique: true });

// Prevent duplicate model compilation
module.exports = mongoose.models.Adoption || mongoose.model('Adoption', adoptionSchema);