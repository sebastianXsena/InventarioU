const db = require('../config/database');

class ItemRepository {
  async create({ name, description, totalStock, labId }) {
    const query = `
      INSERT INTO items (name, description, total_stock, available_stock, lab_id)
      VALUES ($1, $2, $3, $3, $4)
      RETURNING *
    `;
    const { rows } = await db.query(query, [name, description || '', totalStock, labId]);
    return rows[0];
  }

  async findAll() {
    const query = `
      SELECT i.*, l.name AS lab_name
      FROM items i
      JOIN laboratories l ON i.lab_id = l.id
      ORDER BY l.name, i.name
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  async findById(id) {
    const query = `
      SELECT i.*, l.name AS lab_name
      FROM items i
      JOIN laboratories l ON i.lab_id = l.id
      WHERE i.id = $1
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }

  async findByLabId(labId) {
    const query = 'SELECT * FROM items WHERE lab_id = $1 ORDER BY name';
    const { rows } = await db.query(query, [labId]);
    return rows;
  }

  async update(id, { name, description, totalStock }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (totalStock !== undefined) {
      fields.push(`total_stock = $${idx++}`);
      values.push(totalStock);
      fields.push(`available_stock = LEAST(available_stock + ($${idx} - total_stock), $${idx})`);
      values.push(totalStock);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const query = `UPDATE items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  async delete(id) {
    const query = 'DELETE FROM items WHERE id = $1 RETURNING id';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }

  async getUsageStats() {
    const query = 'SELECT * FROM v_item_usage ORDER BY usage_percentage DESC';
    const { rows } = await db.query(query);
    return rows;
  }
}

module.exports = new ItemRepository();
