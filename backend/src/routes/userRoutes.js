const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  validateUserRegister,
  validateUserLogin,
} = require('../middleware/validation');
const userController = require('../controllers/UserController');

const router = express.Router();

router.post('/register', validateUserRegister, userController.register);
router.post('/login', validateUserLogin, userController.login);
router.post('/forgot-password', userController.forgotPassword);
router.get('/me', authenticate, userController.getProfile);
router.put('/me', authenticate, userController.updateProfile);
router.put('/me/password', authenticate, userController.changePassword);
router.get('/', authenticate, authorize('admin'), userController.getAllUsers);

module.exports = router;
