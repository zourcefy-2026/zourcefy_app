const express = require('express');
const router = express.Router();
const poolController = require('../controllers/poolController');

// POST /api/pools/join-pool
router.post('/join-pool', poolController.joinPool);

// POST /api/pools - Manually create a pool
router.post('/', poolController.createPool);

// GET /api/pools/active - Get list of active pools
router.get('/active', poolController.getActivePools);

// GET /api/pools/:id - Get pool details by ID (including members)
router.get('/:id', poolController.getPoolDetails);

module.exports = router;
