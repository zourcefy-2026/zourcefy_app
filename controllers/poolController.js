const Pool = require('../models/Pool');
const PoolMember = require('../models/PoolMember');
const ProcurementBatch = require('../models/ProcurementBatch');

// @desc    Join an active pool or create one if none exists
// @route   POST /api/pools/join-pool
// @access  Public
exports.joinPool = async (req, res) => {
  try {
    const { productId, customerId, orderId, quantity } = req.body;

    // Validate inputs
    if (!productId || !customerId || !orderId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide productId, customerId, orderId, and quantity',
      });
    }

    const parsedQuantity = parseInt(quantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer',
      });
    }

    // Check if the order has already joined any pool (idempotency check)
    const existingMember = await PoolMember.findOne({ orderId });
    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: `Order ${orderId} has already joined a pool.`,
        data: { member: existingMember },
      });
    }

    // Get or atomically create an active pool for the product
    const defaultTargetQuantity = parseInt(process.env.DEFAULT_TARGET_QUANTITY, 10) || 100;
    let pool = await Pool.findOneAndUpdate(
      { productId, status: 'active' },
      { $setOnInsert: { targetQuantity: defaultTargetQuantity } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Create PoolMember record
    let member;
    try {
      member = await PoolMember.create({
        poolId: pool._id,
        customerId,
        orderId,
        quantity: parsedQuantity,
      });
    } catch (err) {
      // Catch double-submit race condition if two requests with same orderId bypassed the first check concurrently
      if (err.code === 11000) {
        return res.status(400).json({
          success: false,
          message: `Order ${orderId} has already joined a pool.`,
        });
      }
      throw err;
    }

    // Increment current quantity of the pool
    pool = await Pool.findByIdAndUpdate(
      pool._id,
      { $inc: { currentQuantity: parsedQuantity } },
      { new: true }
    );

    let batchCreated = false;
    let procurementBatch = null;

    // Check if target quantity is met and mark complete
    if (pool.currentQuantity >= pool.targetQuantity && pool.status === 'active') {
      // Atomically complete the pool to avoid race conditions with multiple concurrent completions
      const completedPool = await Pool.findOneAndUpdate(
        { _id: pool._id, status: 'active' },
        { status: 'completed', completedAt: new Date() },
        { new: true }
      );

      if (completedPool) {
        pool = completedPool;
        // Create procurement batch
        procurementBatch = await ProcurementBatch.create({
          poolId: pool._id,
          productId: pool.productId,
          totalQuantity: pool.currentQuantity,
          status: 'pending',
        });
        batchCreated = true;
      }
    }

    res.status(200).json({
      success: true,
      message: batchCreated ? 'Pool met target and completed! Procurement batch generated.' : 'Successfully joined pool.',
      data: {
        pool,
        member,
        batchCreated,
        procurementBatch,
      },
    });
  } catch (error) {
    console.error('Error in joinPool:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while joining pool',
      error: error.message,
    });
  }
};

// @desc    Manually create a pool with a specific target quantity
// @route   POST /api/pools
// @access  Public
exports.createPool = async (req, res) => {
  try {
    const { productId, targetQuantity } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    const parsedTarget = parseInt(targetQuantity, 10);
    if (targetQuantity !== undefined && (isNaN(parsedTarget) || parsedTarget <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Target quantity must be a positive integer',
      });
    }

    // Check if an active pool already exists for this product
    const existingActivePool = await Pool.findOne({ productId, status: 'active' });
    if (existingActivePool) {
      return res.status(400).json({
        success: false,
        message: `An active pool already exists for product ${productId}`,
        data: existingActivePool,
      });
    }

    const defaultTargetQuantity = parseInt(process.env.DEFAULT_TARGET_QUANTITY, 10) || 100;
    const pool = await Pool.create({
      productId,
      targetQuantity: parsedTarget || defaultTargetQuantity,
      currentQuantity: 0,
      status: 'active',
    });

    res.status(201).json({
      success: true,
      message: 'Pool created successfully',
      data: pool,
    });
  } catch (error) {
    console.error('Error in createPool:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating pool',
      error: error.message,
    });
  }
};

// @desc    Get all active pools
// @route   GET /api/pools/active
// @access  Public
exports.getActivePools = async (req, res) => {
  try {
    const pools = await Pool.find({ status: 'active' });
    res.status(200).json({
      success: true,
      count: pools.length,
      data: pools,
    });
  } catch (error) {
    console.error('Error in getActivePools:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active pools',
      error: error.message,
    });
  }
};

// @desc    Get pool details by ID along with its members
// @route   GET /api/pools/:id
// @access  Public
exports.getPoolDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await Pool.findById(id);
    if (!pool) {
      return res.status(404).json({
        success: false,
        message: 'Pool not found',
      });
    }

    const members = await PoolMember.find({ poolId: pool._id });

    res.status(200).json({
      success: true,
      data: {
        pool,
        members,
      },
    });
  } catch (error) {
    console.error('Error in getPoolDetails:', error);
    // Handle invalid ObjectId cast error
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid pool ID format',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pool details',
      error: error.message,
    });
  }
};
