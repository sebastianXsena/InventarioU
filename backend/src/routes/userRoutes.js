const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  validateUserRegister,
  validateUserLogin,
} = require('../middleware/validation');
const userController = require('../controllers/userController');

const router = express.Router();

router.post('/register', validateUserRegister, userController.register);
router.post('/login', validateUserLogin, userController.login);
router.get('/me', authenticate, userController.getProfile);
router.get('/', authenticate, authorize('admin'), userController.getAllUsers);

module.exports = router;
