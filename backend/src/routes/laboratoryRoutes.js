const express = require('express');
const LaboratoryController = require('../controllers/LaboratoryController');
const { authMiddleware, adminMiddleware } = require('../middlewares');

const router = express.Router();

// Rutas públicas (con autenticación)
router.use(authMiddleware);

router.get('/', (req, res, next) => LaboratoryController.getLaboratories(req, res, next));
router.get('/active', (req, res, next) => LaboratoryController.getActiveLaboratories(req, res, next));
router.get('/:id', (req, res, next) => LaboratoryController.getLaboratory(req, res, next));

// Rutas de admin
router.use(adminMiddleware);

router.post('/', (req, res, next) => LaboratoryController.createLaboratory(req, res, next));
router.patch('/:id', (req, res, next) => LaboratoryController.updateLaboratory(req, res, next));
router.patch('/:id/status', (req, res, next) => LaboratoryController.changeLaboratoryStatus(req, res, next));
router.delete('/:id', (req, res, next) => LaboratoryController.deleteLaboratory(req, res, next));

module.exports = router;
