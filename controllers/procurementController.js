const ProcurementBatch = require('../models/ProcurementBatch');

// @desc    Get all procurement batches
// @route   GET /api/procurements
// @access  Public
exports.getProcurementBatches = async (req, res) => {
  try {
    const { status, productId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (productId) filter.productId = productId;

    const batches = await ProcurementBatch.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    console.error('Error in getProcurementBatches:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching procurement batches',
      error: error.message,
    });
  }
};

// @desc    Update procurement batch status
// @route   PATCH /api/procurements/:id
// @access  Public
exports.updateBatchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const validStatuses = ['pending', 'ordered', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const batch = await ProcurementBatch.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Procurement batch not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Procurement batch status updated successfully',
      data: batch,
    });
  } catch (error) {
    console.error('Error in updateBatchStatus:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid procurement batch ID format',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while updating procurement batch status',
      error: error.message,
    });
  }
};
