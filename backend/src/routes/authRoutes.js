const express = require('express');
const AuthController = require('../controllers/AuthController');

const router = express.Router();

// Rutas públicas
router.post('/register', (req, res, next) => AuthController.register(req, res, next));
router.post('/login', (req, res, next) => AuthController.login(req, res, next));

module.exports = router;
