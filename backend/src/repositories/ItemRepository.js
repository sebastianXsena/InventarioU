const pool = require('../config/database');

class ItemRepository {
  // Crear item
  async create(itemData) {
    const { lab_id, name, description, total_stock, reorder_level } = itemData;
    const query = `
      INSERT INTO items (lab_id, name, description, total_stock, available_stock, reorder_level)
      VALUES ($1, $2, $3, $4, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [lab_id, name, description, total_stock, reorder_level]);
    return result.rows[0];
  }

  // Obtener item por ID
  async findById(id) {
    const query = 'SELECT * FROM items WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Obtener items por laboratorio
  async findByLaboratory(labId, limit = 10, offset = 0) {
    const query = `
      SELECT * FROM items 
      WHERE lab_id = $1
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [labId, limit, offset]);
    return result.rows;
  }

  // Obtener todos los items
  async findAll(limit = 10, offset = 0) {
    const query = 'SELECT * FROM items LIMIT $1 OFFSET $2';
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Actualizar item
  async update(id, itemData) {
    const { name, description, total_stock, available_stock, reorder_level } = itemData;
    const query = `
      UPDATE items
      SET name = COALESCE($2, name),
          description = COALESCE($3, description),
          total_stock = COALESCE($4, total_stock),
          available_stock = COALESCE($5, available_stock),
          reorder_level = COALESCE($6, reorder_level)
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [id, name, description, total_stock, available_stock, reorder_level]);
    return result.rows[0];
  }

  // Eliminar item
  async delete(id) {
    const query = 'DELETE FROM items WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Obtener estadísticas de uso
  async getUsageStats(id) {
    const query = `
      SELECT * FROM item_usage_stats
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Verificar disponibilidad de stock
  async checkAvailability(itemId, quantity) {
    const query = 'SELECT available_stock FROM items WHERE id = $1';
    const result = await pool.query(query, [itemId]);
    if (!result.rows[0]) return false;
    return result.rows[0].available_stock >= quantity;
  }
}

module.exports = new ItemRepository();
