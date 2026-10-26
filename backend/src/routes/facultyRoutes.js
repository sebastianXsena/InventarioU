const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, facultyController.getAll);
router.get('/:id', authenticate, facultyController.getById);

// Admin only routes
router.post('/', authenticate, authorize('admin'), facultyController.create);
router.put('/:id', authenticate, authorize('admin'), facultyController.update);
router.delete('/:id', authenticate, authorize('admin'), facultyController.delete);

module.exports = router;
