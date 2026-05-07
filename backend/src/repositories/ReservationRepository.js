const pool = require('../config/database');

class ReservationRepository {
  // Crear reserva (transacción)
  async create(reservationData, client = null) {
    const { user_id, lab_id, start_time, end_time, items } = reservationData;
    const db = client || pool;

    try {
      // Insertar reserva
      const query = `
        INSERT INTO reservations (user_id, lab_id, start_time, end_time, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *;
      `;
      const result = await db.query(query, [user_id, lab_id, start_time, end_time]);
      const reservation = result.rows[0];

      // Insertar items de la reserva
      for (const item of items) {
        const itemQuery = `
          INSERT INTO reservation_items (reservation_id, item_id, quantity_requested)
          VALUES ($1, $2, $3)
        `;
        await db.query(itemQuery, [reservation.id, item.item_id, item.quantity_requested]);
      }

      return reservation;
    } catch (error) {
      throw error;
    }
  }

  // Obtener reserva por ID
  async findById(id) {
    const query = `
      SELECT r.*, 
        json_agg(json_build_object('item_id', ri.item_id, 'quantity_requested', ri.quantity_requested)) as items
      FROM reservations r
      LEFT JOIN reservation_items ri ON r.id = ri.reservation_id
      WHERE r.id = $1
      GROUP BY r.id;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Obtener reservas por usuario
  async findByUser(userId, limit = 10, offset = 0) {
    const query = `
      SELECT r.*, 
        json_agg(json_build_object('item_id', ri.item_id, 'quantity_requested', ri.quantity_requested)) as items
      FROM reservations r
      LEFT JOIN reservation_items ri ON r.id = ri.reservation_id
      WHERE r.user_id = $1
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Obtener reservas por laboratorio
  async findByLaboratory(labId, status = null, limit = 10, offset = 0) {
    let query = `
      SELECT r.*, 
        json_agg(json_build_object('item_id', ri.item_id, 'quantity_requested', ri.quantity_requested)) as items
      FROM reservations r
      LEFT JOIN reservation_items ri ON r.id = ri.reservation_id
      WHERE r.lab_id = $1
    `;
    const params = [labId, limit, offset];

    if (status) {
      query += ` AND r.status = $4`;
      params.push(status);
      query += `
        GROUP BY r.id
        ORDER BY r.start_time ASC
        LIMIT $2 OFFSET $3
      `;
    } else {
      query += `
        GROUP BY r.id
        ORDER BY r.start_time ASC
        LIMIT $2 OFFSET $3
      `;
    }

    const result = await pool.query(query, params.slice(0, status ? 4 : 3));
    return result.rows;
  }

  // Obtener todas las reservas
  async findAll(limit = 10, offset = 0) {
    const query = `
      SELECT r.*, 
        json_agg(json_build_object('item_id', ri.item_id, 'quantity_requested', ri.quantity_requested)) as items
      FROM reservations r
      LEFT JOIN reservation_items ri ON r.id = ri.reservation_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Actualizar estado de reserva
  async updateStatus(id, status, rejectReason = null, approvedBy = null) {
    const query = `
      UPDATE reservations
      SET status = $2,
          rejection_reason = $3,
          approved_by = $4,
          approved_at = CASE WHEN $2 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [id, status, rejectReason, approvedBy]);
    return result.rows[0];
  }

  // Verificar conflicto de horarios
  async checkTimeConflict(labId, startTime, endTime, excludeReservationId = null) {
    let query = `
      SELECT COUNT(*) FROM reservations
      WHERE lab_id = $1
      AND status IN ('approved', 'pending')
      AND (
        (start_time < $3 AND end_time > $2)
      )
    `;
    const params = [labId, startTime, endTime];

    if (excludeReservationId) {
      query += ` AND id != $4`;
      params.push(excludeReservationId);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10) > 0;
  }

  // Contar reservas
  async count() {
    const query = 'SELECT COUNT(*) FROM reservations';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count, 10);
  }

  // Obtener reservas próximas a completar
  async getUpcomingReservations(days = 7) {
    const query = `
      SELECT * FROM reservations
      WHERE status = 'approved'
      AND start_time BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '${days} days'
      ORDER BY start_time ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = new ReservationRepository();
