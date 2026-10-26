const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  validateReservationCreate,
  validateReservationApprove,
} = require('../middleware/validation');
const reservationController = require('../controllers/ReservationController');

const router = express.Router();

router.get('/', authenticate, reservationController.getAll);
router.get('/my', authenticate, reservationController.getMyReservations);
router.get('/lab/:labId', authenticate, reservationController.getByLabAndDateRange);
router.get('/report/:year/:month', authenticate, authorize('admin'), reservationController.getMonthlyReport);
router.get('/report-range', authenticate, authorize('admin'), reservationController.getReportByDateRange);
router.get('/:id', authenticate, reservationController.getById);
router.post('/', authenticate, validateReservationCreate, reservationController.create);
router.patch('/:id/approve', authenticate, authorize('admin'), validateReservationApprove, reservationController.approveOrReject);
router.patch('/:id/cancel', authenticate, reservationController.cancel);

module.exports = router;
