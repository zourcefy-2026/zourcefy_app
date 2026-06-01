const mongoose = require('mongoose');

const getModel = () => {
  if (process.env.MOCK_DB === 'true') {
    return require('./mockDb').MockPoolMember;
  }

  if (mongoose.models.PoolMember) {
    return mongoose.models.PoolMember;
  }

  const poolMemberSchema = new mongoose.Schema({
    poolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pool',
      required: [true, 'Pool ID is required'],
      index: true,
    },
    customerId: {
      type: String,
      required: [true, 'Customer ID is required'],
      trim: true,
    },
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      trim: true,
      unique: true, // Prevent same order from joining multiple times
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  });

  return mongoose.model('PoolMember', poolMemberSchema);
};

// Use ES6 Proxy to dynamically delegate calls to Mongoose or Mock DB at runtime
module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    const value = model[prop];
    return typeof value === 'function' ? value.bind(model) : value;
  }
});
