const reservationService = require('../services/reservationService');

const create = async (req, res, next) => {
  try {
    const reservation = await reservationService.create(req.user.id, req.body);
    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.lab_id) filters.labId = req.query.lab_id;
    if (req.query.user_id) filters.userId = req.query.user_id;
    if (req.query.start_date) filters.startDate = req.query.start_date;
    if (req.query.end_date) filters.endDate = req.query.end_date;

    const reservations = await reservationService.getAll(filters);
    res.json(reservations);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const reservation = await reservationService.getById(req.params.id);
    res.json(reservation);
  } catch (error) {
    next(error);
  }
};

const getMyReservations = async (req, res, next) => {
  try {
    const reservations = await reservationService.getByUserId(req.user.id);
    res.json(reservations);
  } catch (error) {
    next(error);
  }
};

const getByLabAndDateRange = async (req, res, next) => {
  try {
    const { labId } = req.params;
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      const err = new Error('start_date and end_date query params required');
      err.statusCode = 400;
      throw err;
    }
    const reservations = await reservationService.getByLabAndDateRange(labId, start_date, end_date);
    res.json(reservations);
  } catch (error) {
    next(error);
  }
};

const approveOrReject = async (req, res, next) => {
  try {
    const { status } = req.body;
    const reservation = await reservationService.approveOrReject(
      req.params.id,
      status,
      req.user.id
    );
    res.json(reservation);
  } catch (error) {
    next(error);
  }
};

const cancel = async (req, res, next) => {
  try {
    const reservation = await reservationService.cancel(req.params.id, req.user.id);
    res.json(reservation);
  } catch (error) {
    next(error);
  }
};

const getMonthlyReport = async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const report = await reservationService.getMonthlyReport(
      parseInt(year, 10),
      parseInt(month, 10)
    );
    res.json(report);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  getMyReservations,
  getByLabAndDateRange,
  approveOrReject,
  cancel,
  getMonthlyReport,
};
