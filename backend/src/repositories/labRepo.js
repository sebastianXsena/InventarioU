const db = require('../config/database');

class LabRepository {
  async create({ name, location, capacity, status, blocked_schedule }) {
    const query = `
      INSERT INTO laboratories (name, location, capacity, status, blocked_schedule)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING *
    `;
    const schedule = blocked_schedule === undefined ? [] : blocked_schedule;
    const scheduleJson = typeof schedule === 'string' ? schedule : JSON.stringify(schedule);
    const { rows } = await db.query(query, [name, location, capacity, status, scheduleJson]);
    return rows[0];
  }

  async findAll() {
    const query = 'SELECT * FROM laboratories ORDER BY name';
    const { rows } = await db.query(query);
    return rows;
  }

  async findById(id) {
    const query = 'SELECT * FROM laboratories WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }

  async update(id, { name, location, capacity, status, blocked_schedule }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (location !== undefined) { fields.push(`location = $${idx++}`); values.push(location); }
    if (capacity !== undefined) { fields.push(`capacity = $${idx++}`); values.push(capacity); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
    if (blocked_schedule !== undefined) {
      fields.push(`blocked_schedule = $${idx++}::jsonb`);
      const scheduleJson = typeof blocked_schedule === 'string' ? blocked_schedule : JSON.stringify(blocked_schedule);
      values.push(scheduleJson);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const query = `UPDATE laboratories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  async delete(id) {
    const query = 'DELETE FROM laboratories WHERE id = $1 RETURNING id';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  async findActive() {
    const query = "SELECT * FROM laboratories WHERE status = 'active' ORDER BY name";
    const { rows } = await db.query(query);
    return rows;
  }
}

module.exports = new LabRepository();
