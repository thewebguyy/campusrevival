const mongoose = require('mongoose');

/** Maximum number of adopters a school can have (prevents unbounded array). */
const MAX_ADOPTERS = 500;

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'School name is required'],
      trim: true,
      unique: true,
      index: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    lat: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
    },
    lng: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      minlength: [5, 'Address must be at least 5 characters'],
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },
    city: {
      type: String,
      trim: true,
      index: true,
      maxlength: [100, 'City name cannot exceed 100 characters'],
    },
    country: {
      type: String,
      default: 'United Kingdom',
      trim: true,
    },
    adopters: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        adoptionType: {
          type: String,
          enum: ['prayer', 'revival', 'both'],
          default: 'prayer',
        },
        adoptedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    adoptionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending_review', 'archived'],
      default: 'active',
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    website: {
      type: String,
      trim: true,
      validate: {
        validator(v) {
          if (!v) return true;
          return /^https?:\/\/.+\..+/.test(v);
        },
        message: 'Website must be a valid URL starting with http:// or https://',
      },
    },
    image: {
      type: String,
      trim: true,
    },
    stats: {
      totalPrayerAdoptions: { type: Number, default: 0, min: 0 },
      totalRevivalAdoptions: { type: Number, default: 0, min: 0 },
      lastAdoptedAt: { type: Date },
      totalJournalEntries: { type: Number, default: 0, min: 0 },
    },
    timezone: {
      type: String,
      default: 'Europe/London',
    },
    partnerOrganizations: [
      {
        name: String,
        logo: String,
        website: String,
      },
    ],
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Admin notes cannot exceed 2000 characters'],
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────────────────
schoolSchema.index({ lat: 1, lng: 1 });
schoolSchema.index({ status: 1, featured: -1 });
schoolSchema.index({ 'adopters.userId': 1 });
schoolSchema.index({ city: 1, status: 1 });
schoolSchema.index({ adoptionCount: -1 });

// ── Virtuals ─────────────────────────────────────────────
schoolSchema.virtual('isAdopted').get(function () {
  return this.adopters?.length > 0;
});

schoolSchema.virtual('prayerAdopterCount').get(function () {
  if (!this.adopters) return 0;
  return this.adopters.filter(
    (a) => a.adoptionType === 'prayer' || a.adoptionType === 'both'
  ).length;
});

schoolSchema.virtual('revivalAdopterCount').get(function () {
  if (!this.adopters) return 0;
  return this.adopters.filter(
    (a) => a.adoptionType === 'revival' || a.adoptionType === 'both'
  ).length;
});

// ── Instance methods ─────────────────────────────────────

/**
 * Check whether the given user has already adopted this school.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {boolean}
 */
schoolSchema.methods.isAdoptedByUser = function (userId) {
  return this.adopters.some(
    (a) => a.userId.toString() === userId.toString()
  );
};

/**
 * Add a new adopter **atomically** using `$push` + `$inc`.
 * This avoids race conditions between concurrent requests.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {'prayer'|'revival'|'both'} adoptionType
 * @returns {Promise<this|false>} Updated school or false if already adopted.
 */
schoolSchema.methods.addAdopter = async function (userId, adoptionType = 'prayer') {
  if (this.isAdoptedByUser(userId)) return false;

  if (this.adopters.length >= MAX_ADOPTERS) {
    throw new Error(
      `This school has reached the maximum number of adopters (${MAX_ADOPTERS}).`
    );
  }

  const update = {
    $push: {
      adopters: { userId, adoptionType, adoptedAt: new Date() },
    },
    $inc: { adoptionCount: 1 },
    $set: { 'stats.lastAdoptedAt': new Date() },
  };

  if (adoptionType === 'prayer' || adoptionType === 'both') {
    update.$inc['stats.totalPrayerAdoptions'] = 1;
  }
  if (adoptionType === 'revival' || adoptionType === 'both') {
    update.$inc['stats.totalRevivalAdoptions'] = 1;
  }

  const updated = await this.constructor.findByIdAndUpdate(
    this._id,
    update,
    { new: true }
  );
  return updated;
};

/**
 * Remove an adopter atomically.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<boolean>}
 */
schoolSchema.methods.removeAdopter = async function (userId) {
  const result = await this.constructor.findByIdAndUpdate(
    this._id,
    {
      $pull: { adopters: { userId } },
      $inc: { adoptionCount: -1 },
    },
    { new: true }
  );
  return !!result;
};

// ── Statics ──────────────────────────────────────────────

/** Get active featured schools, sorted by popularity. */
schoolSchema.statics.getFeatured = function (limit = 10) {
  return this.find({ featured: true, status: 'active' })
    .sort({ adoptionCount: -1 })
    .limit(limit)
    .select('name address lat lng image adoptionCount');
};

/** Get most adopted active schools. */
schoolSchema.statics.getMostAdopted = function (limit = 10) {
  return this.find({ status: 'active' })
    .sort({ adoptionCount: -1, createdAt: -1 })
    .limit(limit)
    .select('name address city adoptionCount stats');
};

/**
 * Search schools by name, city, or address.
 *
 * @param {string} searchTerm
 * @param {{ status?: string, limit?: number, page?: number }} options
 */
schoolSchema.statics.search = function (searchTerm, options = {}) {
  const limit = Math.min(options.limit || 20, 100);
  const page = Math.max(options.page || 1, 1);

  const query = {
    status: options.status || 'active',
    $or: [
      { name: new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { city: new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { address: new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    ],
  };

  return this.find(query)
    .sort({ adoptionCount: -1, name: 1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// ── Hooks ────────────────────────────────────────────────

/** Keep adoptionCount in sync with the adopters array on save. */
schoolSchema.pre('save', function (next) {
  if (this.isModified('adopters')) {
    this.adoptionCount = this.adopters.length;
  }
  next();
});

/** Extract city from address if not provided. */
schoolSchema.pre('save', function (next) {
  if (!this.city && this.address) {
    const parts = this.address.split(',');
    if (parts.length >= 2) {
      this.city = parts[parts.length - 2].trim();
    }
  }
  next();
});

/**
 * Generate a URL-friendly slug from the school name.
 * Appends a short random suffix to avoid collisions.
 */
schoolSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    const base = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Append a short random suffix for uniqueness
    const suffix = Math.random().toString(36).substring(2, 6);
    this.slug = `${base}-${suffix}`;
  }
  next();
});

/** Exclude archived schools from find queries by default. */
schoolSchema.pre(/^find/, function (next) {
  if (!this.getOptions().includeArchived) {
    this.where({ status: { $ne: 'archived' } });
  }
  next();
});

// Prevent duplicate model compilation in serverless
module.exports =
  mongoose.models.School || mongoose.model('School', schoolSchema);