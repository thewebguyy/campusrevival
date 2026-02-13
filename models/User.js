const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    role: {
      type: String,
      enum: ['adopter', 'admin'],
      default: 'adopter',
    },
    streakCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPrayerDate: {
      type: Date,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    image: {
      type: String,
    },
    isVerifiedLeader: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    university: {
      type: String,
      trim: true,
    },
    universityEmail: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator(v) {
          if (!v) return true;
          return /^\S+@\S+\.\S+$/.test(v);
        },
        message: 'Please provide a valid university email address',
      },
    },
    /** Token version — increment to revoke all refresh tokens. */
    tokenVersion: {
      type: Number,
      default: 0,
    },
    organization: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ──────────────────────────────────────────────────
userSchema.index({ email: 1 });

// ── Hooks ────────────────────────────────────────────────────
/**
 * Hash password only when it has been modified (guards against
 * double-hashing on unrelated .save() calls).
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ── Instance methods ─────────────────────────────────────────
/**
 * Compare a plain-text password candidate to the stored hash.
 *
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Strip password from serialised output.
 */
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

/**
 * Update the user's prayer streak using UTC dates so it is
 * timezone-independent.
 *
 * @returns {Promise<this>}
 */
userSchema.methods.updateStreak = async function () {
  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  if (!this.lastPrayerDate) {
    this.streakCount = 1;
  } else {
    const lastUTC = Date.UTC(
      this.lastPrayerDate.getUTCFullYear(),
      this.lastPrayerDate.getUTCMonth(),
      this.lastPrayerDate.getUTCDate()
    );
    const diffDays = Math.floor((todayUTC - lastUTC) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      this.streakCount += 1;
    } else if (diffDays > 1) {
      this.streakCount = 1; // streak broken
    }
    // diffDays === 0 → already prayed today, keep streak
  }

  this.lastPrayerDate = now;
  return this.save();
};

// Prevent duplicate model compilation in serverless
module.exports = mongoose.models.User || mongoose.model('User', userSchema);