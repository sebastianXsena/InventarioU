const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  validateLabCreate,
  validateLabUpdate,
} = require('../middleware/validation');
const labController = require('../controllers/labController');

const router = express.Router();

router.get('/', labController.getAll);
router.get('/active', labController.getActive);
router.get('/:id', labController.getById);
router.post('/', authenticate, authorize('admin'), validateLabCreate, labController.create);
router.patch('/:id', authenticate, authorize('admin'), validateLabUpdate, labController.update);
router.delete('/:id', authenticate, authorize('admin'), labController.remove);

module.exports = router;
