const db = require('../config/database');
const reservationRepo = require('../repositories/reservationRepo');
const labRepo = require('../repositories/labRepo');

class ReservationService {
  async create(userId, { labId, startTime, endTime, items, notes }) {
    const lab = await labRepo.findById(labId);
    if (!lab) {
      const err = new Error('Laboratory not found');
      err.statusCode = 404;
      throw err;
    }

    if (lab.status === 'maintenance') {
      const err = new Error('Laboratory is under maintenance');
      err.statusCode = 400;
      throw err;
    }

    const startDate = new Date(startTime);
    if (startDate <= new Date()) {
      const err = new Error('Reservations cannot be made for past dates');
      err.statusCode = 400;
      throw err;
    }

    const hasOverlap = await reservationRepo.checkOverlap(labId, startTime, endTime);
    if (hasOverlap) {
      const err = new Error('Time slot conflict - laboratory already reserved');
      err.statusCode = 409;
      throw err;
    }

    if (items && items.length > 0) {
      const stockCheck = await reservationRepo.checkStockAvailability(items);
      if (!stockCheck.available) {
        const err = new Error(stockCheck.reason);
        err.statusCode = 400;
        throw err;
      }
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const reservation = await reservationRepo.create(
        { userId, labId, startTime, endTime, notes },
        client
      );

      if (items && items.length > 0) {
        const formattedItems = items.map((item) => ({
          itemId: item.item_id,
          quantityUsed: item.quantity_used,
        }));
        await reservationRepo.addItems(reservation.id, formattedItems, client);
      }

      await client.query('COMMIT');

      return this.getById(reservation.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getById(id) {
    const reservation = await reservationRepo.findById(id);
    if (!reservation) {
      const err = new Error('Reservation not found');
      err.statusCode = 404;
      throw err;
    }

    const items = await reservationRepo.getItemsByReservation(id);
    return { ...reservation, items };
  }

  async getAll(filters = {}) {
    const reservations = await reservationRepo.findAll(filters);
    return Promise.all(
      reservations.map(async (r) => {
        const items = await reservationRepo.getItemsByReservation(r.id);
        return { ...r, items };
      })
    );
  }

  async getByUserId(userId) {
    const reservations = await reservationRepo.findByUserId(userId);
    return Promise.all(
      reservations.map(async (r) => {
        const items = await reservationRepo.getItemsByReservation(r.id);
        return { ...r, items };
      })
    );
  }

  async getByLabAndDateRange(labId, startDate, endDate) {
    return reservationRepo.findByLabAndDateRange(labId, startDate, endDate);
  }

  async approveOrReject(reservationId, status, adminId) {
    const reservation = await reservationRepo.findById(reservationId);
    if (!reservation) {
      const err = new Error('Reservation not found');
      err.statusCode = 404;
      throw err;
    }

    if (reservation.status !== 'pending') {
      const err = new Error(`Reservation is already ${reservation.status}`);
      err.statusCode = 400;
      throw err;
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      await reservationRepo.updateStatus(reservationId, status, client);

      if (status === 'approved') {
        const items = await reservationRepo.getItemsByReservation(reservationId, client);
        if (items.length > 0) {
          await reservationRepo.deductStock(items, client);
        }
      } else if (status === 'rejected') {
        // No stock changes needed for rejected (stock only deducted on approve)
      }

      await client.query('COMMIT');

      return this.getById(reservationId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async cancel(reservationId, userId) {
    const reservation = await reservationRepo.findById(reservationId);
    if (!reservation) {
      const err = new Error('Reservation not found');
      err.statusCode = 404;
      throw err;
    }

    if (reservation.user_id !== userId) {
      const err = new Error('Unauthorized');
      err.statusCode = 403;
      throw err;
    }

    if (reservation.status === 'approved') {
      const items = await reservationRepo.getItemsByReservation(reservationId);
      if (items.length > 0) {
        const client = await db.getClient();
        try {
          await client.query('BEGIN');
          await reservationRepo.updateStatus(reservationId, 'cancelled', client);
          await reservationRepo.restoreStock(items, client);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        return this.getById(reservationId);
      }
    }

    if (reservation.status === 'pending') {
      return reservationRepo.updateStatus(reservationId, 'cancelled');
    }

    const err = new Error(`Cannot cancel reservation with status: ${reservation.status}`);
    err.statusCode = 400;
    throw err;
  }

  async getMonthlyReport(year, month) {
    return reservationRepo.getMonthlyReport(year, month);
  }
}

module.exports = new ReservationService();
