const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const subscriptionRoutes = require('./routes/subscription');
const paymentRoutes = require('./routes/payment');
const productsRoutes = require('./routes/products');
const promoRoutes = require('./routes/promo');
// const adminRoutes = require('./routes/admin'); // Admin routes temporarily disabled

// Database initialization
let db;
const dbType = process.env.DATABASE_TYPE || 'json';

// Use JSON database by default
const JsonDatabase = require('./database/json-db');
db = new JsonDatabase();

// Make database available globally
global.db = db;

const app = express();
const PORT = process.env.PORT || 5000;

// Custom morgan format for better logging
morgan.token('body', req => JSON.stringify(req.body));
const morganFormat = '[:date[clf]] :method :url :status :response-time ms - :res[content-length]';

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5000',
  credentials: true
}));
app.use(morgan(morganFormat));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  if (Object.keys(req.body).length > 0) {
    console.log(`   Body:`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/promo', promoRoutes);
// app.use('/api/admin', adminRoutes); // Admin routes temporarily disabled

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err.message);
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    code: 'SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`🌍 http://localhost:${PORT}`);
  console.log(`📁 Database: JSON`);
  console.log(`🔑 Auth: Enabled\n`);
});

module.exports = app;