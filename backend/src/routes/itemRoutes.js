const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  validateItemCreate,
  validateItemUpdate,
} = require('../middleware/validation');
const itemController = require('../controllers/itemController');

const router = express.Router();

router.get('/', itemController.getAll);
router.get('/stats', itemController.getUsageStats);
router.get('/lab/:labId', itemController.getByLabId);
router.get('/:id', itemController.getById);
router.post('/', authenticate, authorize('admin'), validateItemCreate, itemController.create);
router.patch('/:id', authenticate, authorize('admin'), validateItemUpdate, itemController.update);
router.delete('/:id', authenticate, authorize('admin'), itemController.remove);

module.exports = router;
