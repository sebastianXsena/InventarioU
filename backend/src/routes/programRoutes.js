const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, programController.getAll);
router.get('/:id', authenticate, programController.getById);

// Admin only routes
router.post('/', authenticate, authorize('admin'), programController.create);
router.put('/:id', authenticate, authorize('admin'), programController.update);
router.delete('/:id', authenticate, authorize('admin'), programController.delete);

module.exports = router;
