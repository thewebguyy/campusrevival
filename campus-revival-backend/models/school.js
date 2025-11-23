const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'School name is required'],
    trim: true,
    unique: true
  },
  lat: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: -90,
    max: 90
  },
  lng: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: -180,
    max: 180
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  
  // Support multiple adopters
  adopters: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    adoptionType: {
      type: String,
      enum: ['prayer', 'revival', 'both'],
      default: 'prayer'
    },
    adoptedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Convenient field for adoption count
  adoptionCount: {
    type: Number,
    default: 0
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  }
}, {
  timestamps: true
});

// Indexes
schoolSchema.index({ lat: 1, lng: 1 });

// Virtual for checking if school has any adopters
schoolSchema.virtual('isAdopted').get(function() {
  return this.adopters && this.adopters.length > 0;
});

// Method to check if user already adopted this school
schoolSchema.methods.isAdoptedByUser = function(userId) {
  return this.adopters.some(adopter => 
    adopter.userId.toString() === userId.toString()
  );
};

// Method to add adopter
schoolSchema.methods.addAdopter = function(userId, adoptionType = 'prayer') {
  if (!this.isAdoptedByUser(userId)) {
    this.adopters.push({
      userId,
      adoptionType,
      adoptedAt: new Date()
    });
    this.adoptionCount = this.adopters.length;
  }
};

// Ensure virtuals are included in JSON
schoolSchema.set('toJSON', { virtuals: true });
schoolSchema.set('toObject', { virtuals: true });

// Prevent duplicate model compilation
module.exports = mongoose.models.School || mongoose.model('School', schoolSchema);