const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  role: {
    type: String,
    enum: ['adopter', 'admin'],
    default: 'adopter'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  streakCount: {
    type: Number,
    default: 0
  },
  lastPrayerDate: {
    type: Date
  },
  bio: {
    type: String,
    maxlength: 500
  },
  image: {
    type: String
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Update streak logic
userSchema.methods.updateStreak = async function () {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!this.lastPrayerDate) {
    this.streakCount = 1;
  } else {
    const lastDate = new Date(this.lastPrayerDate.getFullYear(), this.lastPrayerDate.getMonth(), this.lastPrayerDate.getDate());
    const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      this.streakCount += 1;
    } else if (diffDays > 1) {
      this.streakCount = 1;
    }
    // if diffDays === 0, keep same streak
  }

  this.lastPrayerDate = now;
  return await this.save();
};

// Prevent duplicate model compilation
module.exports = mongoose.models.User || mongoose.model('User', userSchema);