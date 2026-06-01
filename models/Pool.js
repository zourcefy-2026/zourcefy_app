const mongoose = require('mongoose');

const getModel = () => {
  if (process.env.MOCK_DB === 'true') {
    return require('./mockDb').MockPool;
  }

  if (mongoose.models.Pool) {
    return mongoose.models.Pool;
  }

  const poolSchema = new mongoose.Schema({
    productId: {
      type: String,
      required: [true, 'Product ID is required'],
      trim: true,
      index: true,
    },
    targetQuantity: {
      type: Number,
      required: [true, 'Target quantity is required'],
      min: [1, 'Target quantity must be at least 1'],
      default: 100,
    },
    currentQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
  });

  // Composite index to optimize finding active pools per product
  poolSchema.index({ productId: 1, status: 1 });

  return mongoose.model('Pool', poolSchema);
};

// Use ES6 Proxy to dynamically delegate calls to Mongoose or Mock DB at runtime
module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    const value = model[prop];
    return typeof value === 'function' ? value.bind(model) : value;
  }
});
