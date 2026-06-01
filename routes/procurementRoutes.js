const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');

// GET /api/procurements - Get all procurement batches (with optional filters)
router.get('/', procurementController.getProcurementBatches);

// PATCH /api/procurements/:id - Update status of a procurement batch
router.patch('/:id', procurementController.updateBatchStatus);

module.exports = router;
