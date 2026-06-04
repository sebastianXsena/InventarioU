const db = require('../config/database');
const reservationRepo = require('../repositories/reservationRepo');
const labRepo = require('../repositories/labRepo');

class ReservationService {
  isBlockedBySchedule(blockedSchedule, startTime, endTime) {
    if (!Array.isArray(blockedSchedule) || blockedSchedule.length === 0) return false;

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    if (!(end > start)) return false;

    const toDayOfWeek = (d) => ((d.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
    const minutesOfDay = (d) => (d.getHours() * 60) + d.getMinutes();
    const clampEndMinutes = (segEnd, dayEnd) => {
      // If segment ends exactly at day boundary (00:00 next day), treat as 24:00
      if (segEnd.getTime() === dayEnd.getTime()) return 1440;
      return minutesOfDay(segEnd);
    };

    // Iterate each day segment spanned by [start,end)
    const dayCursor = new Date(start);
    dayCursor.setHours(0, 0, 0, 0);

    while (dayCursor < end) {
      const dayStart = new Date(dayCursor);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const segStart = start > dayStart ? start : dayStart;
      const segEnd = end < dayEnd ? end : dayEnd;
      if (segEnd <= segStart) {
        dayCursor.setDate(dayCursor.getDate() + 1);
        continue;
      }

      const dow = toDayOfWeek(dayStart);
      const segStartMin = minutesOfDay(segStart);
      const segEndMin = clampEndMinutes(segEnd, dayEnd);

      for (const entry of blockedSchedule) {
        if (!entry || entry.day_of_week !== dow) continue;
        const [sh, sm] = String(entry.start).split(':').map((n) => parseInt(n, 10));
        const [eh, em] = String(entry.end).split(':').map((n) => parseInt(n, 10));
        const blockStartMin = (sh * 60) + sm;
        const blockEndMin = (eh * 60) + em;

        const overlaps = segStartMin < blockEndMin && segEndMin > blockStartMin;
        if (overlaps) return true;
      }

      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    return false;
  }

  async create(userId, payload) {
    const labId = payload?.labId ?? payload?.lab_id;
    const startTime = payload?.startTime ?? payload?.start_time;
    const endTime = payload?.endTime ?? payload?.end_time;
    const notes = payload?.notes;

    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const normalizedItems = rawItems
      .map((item) => {
        const itemId = item?.itemId ?? item?.item_id;
        const quantityUsedRaw = item?.quantityUsed ?? item?.quantity_used ?? item?.quantity_requested;
        const quantityUsed = Number.parseInt(quantityUsedRaw, 10);
        return {
          itemId,
          quantityUsed: Number.isFinite(quantityUsed) ? quantityUsed : quantityUsedRaw,
        };
      })
      .filter((item) => item.itemId);

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

    if (this.isBlockedBySchedule(lab.blocked_schedule, startTime, endTime)) {
      const err = new Error('Time slot blocked - laboratory has classes');
      err.statusCode = 409;
      throw err;
    }

    const hasOverlap = await reservationRepo.checkOverlap(labId, startTime, endTime);
    if (hasOverlap) {
      const err = new Error('Time slot conflict - laboratory already reserved');
      err.statusCode = 409;
      throw err;
    }

    if (normalizedItems.length > 0) {
      const stockCheck = await reservationRepo.checkStockAvailability(normalizedItems);
      if (!stockCheck.available) {
        const err = new Error(stockCheck.reason);
        err.statusCode = 400;
        throw err;
      }
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const reservation = await reservationRepo.create({ userId, labId, startTime, endTime, notes }, client);

      if (normalizedItems.length > 0) {
        await reservationRepo.addItems(reservation.id, normalizedItems, client);
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

  async getReportByDateRange(startDate, endDate) {
    return reservationRepo.getReportByDateRange(startDate, endDate);
  }
}

module.exports = new ReservationService();
