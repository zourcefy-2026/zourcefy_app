require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const poolRoutes = require('./routes/poolRoutes');
const procurementRoutes = require('./routes/procurementRoutes');
const poolController = require('./controllers/poolController');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Enable JSON parser middleware
app.use(express.json());

// Enable Morgan request logger (dev format)
app.use(morgan('dev'));

// Basic status route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Zourcefy Procurement Pooling API',
    status: 'Running',
  });
});

// Mount routes
app.use('/api/pools', poolRoutes);
app.use('/api/procurements', procurementRoutes);

// Support both /api/pools/join-pool and root /join-pool as referenced in workflow tests
app.post('/join-pool', poolController.joinPool);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
    error: err.message,
  });
});

// Connect to MongoDB using mongoose or fall back to mock database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zourcefy';

const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
};

if (process.env.MOCK_DB === 'true') {
  console.log('Running in MOCK_DB mode (in-memory mock store).');
  startServer();
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log('Successfully connected to MongoDB Database.');
      startServer();
    })
    .catch((err) => {
      console.error('Database connection failed. Details:', err.message);
      console.log('Falling back to MOCK_DB mode (in-memory mock store) for development/testing...');
      process.env.MOCK_DB = 'true';
      startServer();
    });
}
