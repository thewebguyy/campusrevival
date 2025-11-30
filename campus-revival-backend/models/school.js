const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'School name is required'],
    trim: true,
    unique: true,
    index: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  lat: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: [-90, 'Latitude must be between -90 and 90'],
    max: [90, 'Latitude must be between -90 and 90'],
    validate: {
      validator: function(v) {
        return v >= -90 && v <= 90;
      },
      message: 'Invalid latitude coordinates'
    }
  },
  lng: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: [-180, 'Longitude must be between -180 and 180'],
    max: [180, 'Longitude must be between -180 and 180'],
    validate: {
      validator: function(v) {
        return v >= -180 && v <= 180;
      },
      message: 'Invalid longitude coordinates'
    }
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    minlength: [5, 'Address must be at least 5 characters'],
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  city: {
    type: String,
    trim: true,
    index: true,
    maxlength: [100, 'City name cannot exceed 100 characters']
  },
  country: {
    type: String,
    default: 'United Kingdom',
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
  
  // Adoption count for quick access
  adoptionCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Status tracking for admin management
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending_review', 'archived'],
    default: 'active',
    index: true
  },
  
  // Featured schools for homepage
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  
  // Website URL
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        return /^https?:\/\/.+\..+/.test(v);
      },
      message: 'Website must be a valid URL starting with http:// or https://'
    }
  },
  
  // School image (URL or base64)
  image: {
    type: String,
    trim: true
  },
  
  // Statistics for analytics
  stats: {
    totalPrayerAdoptions: { 
      type: Number, 
      default: 0,
      min: 0
    },
    totalRevivalAdoptions: { 
      type: Number, 
      default: 0,
      min: 0
    },
    lastAdoptedAt: { 
      type: Date 
    },
    totalJournalEntries: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Admin notes (not visible to users)
  adminNotes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Admin notes cannot exceed 2000 characters'],
    select: false // Don't include in queries by default
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============== INDEXES ==============
schoolSchema.index({ lat: 1, lng: 1 }); // Geospatial queries
schoolSchema.index({ status: 1, featured: -1 }); // Featured schools query
schoolSchema.index({ 'adopters.userId': 1 }); // Find schools by adopter
schoolSchema.index({ city: 1, status: 1 }); // Filter by city and status
schoolSchema.index({ adoptionCount: -1 }); // Sort by popularity

// ============== VIRTUALS ==============
schoolSchema.virtual('isAdopted').get(function() {
  return this.adopters && this.adopters.length > 0;
});

schoolSchema.virtual('prayerAdopterCount').get(function() {
  if (!this.adopters) return 0;
  return this.adopters.filter(a => a.adoptionType === 'prayer' || a.adoptionType === 'both').length;
});

schoolSchema.virtual('revivalAdopterCount').get(function() {
  if (!this.adopters) return 0;
  return this.adopters.filter(a => a.adoptionType === 'revival' || a.adoptionType === 'both').length;
});

// ============== METHODS ==============
// Check if user already adopted this school
schoolSchema.methods.isAdoptedByUser = function(userId) {
  return this.adopters.some(adopter => 
    adopter.userId.toString() === userId.toString()
  );
};

// Add adopter with stats update
schoolSchema.methods.addAdopter = async function(userId, adoptionType = 'prayer') {
  if (!this.isAdoptedByUser(userId)) {
    this.adopters.push({
      userId,
      adoptionType,
      adoptedAt: new Date()
    });
    
    this.adoptionCount = this.adopters.length;
    
    // Update stats
    if (adoptionType === 'prayer') {
      this.stats.totalPrayerAdoptions += 1;
    } else if (adoptionType === 'revival') {
      this.stats.totalRevivalAdoptions += 1;
    } else if (adoptionType === 'both') {
      this.stats.totalPrayerAdoptions += 1;
      this.stats.totalRevivalAdoptions += 1;
    }
    
    this.stats.lastAdoptedAt = new Date();
    
    await this.save();
    return true;
  }
  return false;
};

// Remove adopter
schoolSchema.methods.removeAdopter = async function(userId) {
  const initialLength = this.adopters.length;
  this.adopters = this.adopters.filter(adopter => 
    adopter.userId.toString() !== userId.toString()
  );
  
  if (this.adopters.length < initialLength) {
    this.adoptionCount = this.adopters.length;
    await this.save();
    return true;
  }
  return false;
};

// ============== STATICS ==============
// Get featured schools
schoolSchema.statics.getFeatured = function(limit = 10) {
  return this.find({ featured: true, status: 'active' })
    .sort({ adoptionCount: -1 })
    .limit(limit)
    .select('name address lat lng image adoptionCount');
};

// Get most adopted schools
schoolSchema.statics.getMostAdopted = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ adoptionCount: -1, createdAt: -1 })
    .limit(limit)
    .select('name address city adoptionCount stats');
};

// Search schools by name or city
schoolSchema.statics.search = function(searchTerm, options = {}) {
  const query = {
    status: options.status || 'active',
    $or: [
      { name: new RegExp(searchTerm, 'i') },
      { city: new RegExp(searchTerm, 'i') },
      { address: new RegExp(searchTerm, 'i') }
    ]
  };
  
  return this.find(query)
    .sort({ adoptionCount: -1, name: 1 })
    .limit(options.limit || 20);
};

// ============== HOOKS ==============
// Pre-save: Update adoption count
schoolSchema.pre('save', function(next) {
  if (this.isModified('adopters')) {
    this.adoptionCount = this.adopters.length;
  }
  next();
});

// Pre-save: Extract city from address if not provided
schoolSchema.pre('save', function(next) {
  if (!this.city && this.address) {
    // Try to extract city from address (last part before country)
    const parts = this.address.split(',');
    if (parts.length >= 2) {
      this.city = parts[parts.length - 2].trim();
    }
  }
  next();
});

// Post-save: Log creation
schoolSchema.post('save', function(doc, next) {
  if (doc.isNew) {
    console.log(`✅ New school created: ${doc.name} (${doc._id})`);
  }
  next();
});

// ============== QUERY MIDDLEWARE ==============
// Exclude archived schools by default
schoolSchema.pre(/^find/, function(next) {
  if (!this.getOptions().includeArchived) {
    this.where({ status: { $ne: 'archived' } });
  }
  next();
});

// Prevent duplicate model compilation
module.exports = mongoose.models.School || mongoose.model('School', schoolSchema);