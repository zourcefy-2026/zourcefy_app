const mongoose = require('mongoose');

const getModel = () => {
  if (process.env.MOCK_DB === 'true') {
    return require('./mockDb').MockProcurementBatch;
  }

  if (mongoose.models.ProcurementBatch) {
    return mongoose.models.ProcurementBatch;
  }

  const procurementBatchSchema = new mongoose.Schema({
    poolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pool',
      required: [true, 'Pool ID is required'],
      index: true,
    },
    productId: {
      type: String,
      required: [true, 'Product ID is required'],
      trim: true,
    },
    totalQuantity: {
      type: Number,
      required: [true, 'Total quantity is required'],
      min: [1, 'Total quantity must be at least 1'],
    },
    status: {
      type: String,
      enum: ['pending', 'ordered', 'completed'],
      default: 'pending',
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  });

  return mongoose.model('ProcurementBatch', procurementBatchSchema);
};

// Use ES6 Proxy to dynamically delegate calls to Mongoose or Mock DB at runtime
module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    const value = model[prop];
    return typeof value === 'function' ? value.bind(model) : value;
  }
});
