require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Check critical environment variables
if (!process.env.MONGODB_URI) {
  console.error('FATAL ERROR: Mongoose URI (MONGODB_URI) is missing');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT Secret (JWT_SECRET) is missing');
  process.exit(1);
}

// ============== MIDDLEWARE ==============
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============== ROUTES ==============
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Campus Revival Movement API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /api/health',
      schools: 'GET /api/schools',
      schoolById: 'GET /api/schools/:id',
      register: 'POST /api/register',
      login: 'POST /api/login',
      me: 'GET /api/me (protected)',
      adoptions: 'GET /api/adoptions (protected)',
      adoptSchool: 'POST /api/adoptions (protected)',
      journal: 'GET /api/journal (protected)',
      createJournal: 'POST /api/journal (protected)'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============== DATABASE CONNECTION ==============
mongoose.connect(process.env.MONGODB_URI, {
  // Mongoose 6+ defaults are sufficient
})
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log(`📍 Database: ${mongoose.connection.name}`);

    // Start server after DB connection
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
      console.log(`📊 Health: http://localhost:${PORT}/api/health\n`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

module.exports = app;