const db = require('../config/database');

class ReservationRepository {
  async create({ userId, labId, startTime, endTime, notes }, client) {
    const executor = client || db;
    const query = `
      INSERT INTO reservations (user_id, lab_id, start_time, end_time, notes, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;
    const { rows } = await executor.query(query, [userId, labId, startTime, endTime, notes || '']);
    return rows[0];
  }

  async findById(id, client) {
    const executor = client || db;
    const query = `
      SELECT r.*,
             u.name AS user_name, u.email AS user_email,
             l.name AS lab_name, l.location AS lab_location
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN laboratories l ON r.lab_id = l.id
      WHERE r.id = $1
    `;
    const { rows } = await executor.query(query, [id]);
    return rows[0] || null;
  }

  async findAll(filters = {}) {
    let query = `
      SELECT r.*,
             u.name AS user_name, u.email AS user_email,
             l.name AS lab_name, l.location AS lab_location
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN laboratories l ON r.lab_id = l.id
      WHERE 1=1
    `;
    const values = [];
    let idx = 1;

    if (filters.status) {
      query += ` AND r.status = $${idx++}`;
      values.push(filters.status);
    }
    if (filters.labId) {
      query += ` AND r.lab_id = $${idx++}`;
      values.push(filters.labId);
    }
    if (filters.userId) {
      query += ` AND r.user_id = $${idx++}`;
      values.push(filters.userId);
    }
    if (filters.startDate) {
      query += ` AND r.start_time >= $${idx++}`;
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ` AND r.end_time <= $${idx++}`;
      values.push(filters.endDate);
    }

    query += ' ORDER BY r.start_time DESC';

    const { rows } = await db.query(query, values);
    return rows;
  }

  async findByUserId(userId) {
    return this.findAll({ userId });
  }

  async findByLabAndDateRange(labId, startDate, endDate) {
    const query = `
      SELECT r.*,
             u.name AS user_name, u.email AS user_email
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      WHERE r.lab_id = $1
        AND r.start_time <= $3
        AND r.end_time >= $2
        AND r.status IN ('approved', 'pending')
      ORDER BY r.start_time
    `;
    const { rows } = await db.query(query, [labId, startDate, endDate]);
    return rows;
  }

  async updateStatus(id, status, client) {
    const executor = client || db;
    const query = `
      UPDATE reservations SET status = $1 WHERE id = $2 RETURNING *
    `;
    const { rows } = await executor.query(query, [status, id]);
    return rows[0];
  }

  async addItems(reservationId, items, client) {
    const executor = client || db;
    const results = [];
    for (const item of items) {
      const query = `
        INSERT INTO reservation_items (reservation_id, item_id, quantity_used)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const { rows } = await executor.query(query, [reservationId, item.itemId, item.quantityUsed]);
      results.push(rows[0]);
    }
    return results;
  }

  async getItemsByReservation(reservationId) {
    const query = `
      SELECT ri.*, i.name AS item_name, i.total_stock
      FROM reservation_items ri
      JOIN items i ON ri.item_id = i.id
      WHERE ri.reservation_id = $1
    `;
    const { rows } = await db.query(query, [reservationId]);
    return rows;
  }

  async getMonthlyReport(year, month) {
    const query = `
      SELECT * FROM v_monthly_report
      WHERE EXTRACT(YEAR FROM start_time) = $1
        AND EXTRACT(MONTH FROM start_time) = $2
      ORDER BY start_time
    `;
    const { rows } = await db.query(query, [year, month]);
    return rows;
  }

  async checkOverlap(labId, startTime, endTime, excludeId) {
    let query = `
      SELECT id FROM reservations
      WHERE lab_id = $1
        AND status IN ('approved', 'pending')
        AND start_time < $3
        AND end_time > $2
    `;
    const values = [labId, startTime, endTime];
    if (excludeId) {
      query += ' AND id != $4';
      values.push(excludeId);
    }
    const { rows } = await db.query(query, values);
    return rows.length > 0;
  }

  async checkStockAvailability(items) {
    const results = [];
    for (const item of items) {
      const { rows } = await db.query(
        'SELECT id, name, available_stock FROM items WHERE id = $1',
        [item.itemId]
      );
      if (rows.length === 0) {
        return { available: false, reason: `Item ${item.itemId} not found` };
      }
      if (rows[0].available_stock < item.quantityUsed) {
        return {
          available: false,
          reason: `Insufficient stock for "${rows[0].name}". Available: ${rows[0].available_stock}, Requested: ${item.quantityUsed}`,
        };
      }
      results.push(rows[0]);
    }
    return { available: true, items: results };
  }

  async deductStock(items, client) {
    const executor = client || db;
    for (const item of items) {
      await executor.query(
        'UPDATE items SET available_stock = available_stock - $1 WHERE id = $2',
        [item.quantityUsed, item.itemId]
      );
    }
  }

  async restoreStock(items, client) {
    const executor = client || db;
    for (const item of items) {
      await executor.query(
        'UPDATE items SET available_stock = LEAST(available_stock + $1, total_stock) WHERE id = $2',
        [item.quantityUsed, item.itemId]
      );
    }
  }
}

module.exports = new ReservationRepository();
