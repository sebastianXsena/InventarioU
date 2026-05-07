const pool = require('../config/database');

class LaboratoryRepository {
  // Crear laboratorio
  async create(labData) {
    const { name, location, capacity, description, status } = labData;
    const query = `
      INSERT INTO laboratories (name, location, capacity, description, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [name, location, capacity, description, status]);
    return result.rows[0];
  }

  // Obtener laboratorio por ID
  async findById(id) {
    const query = 'SELECT * FROM laboratories WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Obtener todos los laboratorios
  async findAll(limit = 10, offset = 0) {
    const query = 'SELECT * FROM laboratories LIMIT $1 OFFSET $2';
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Obtener laboratorios activos
  async findActive(limit = 10, offset = 0) {
    const query = `
      SELECT * FROM laboratories 
      WHERE status = 'active'
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Actualizar laboratorio
  async update(id, labData) {
    const { name, location, capacity, description, status } = labData;
    const query = `
      UPDATE laboratories
      SET name = COALESCE($2, name),
          location = COALESCE($3, location),
          capacity = COALESCE($4, capacity),
          description = COALESCE($5, description),
          status = COALESCE($6, status)
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [id, name, location, capacity, description, status]);
    return result.rows[0];
  }

  // Eliminar laboratorio
  async delete(id) {
    const query = 'DELETE FROM laboratories WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Contar total de laboratorios
  async count() {
    const query = 'SELECT COUNT(*) FROM laboratories';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count, 10);
  }

  // Obtener disponibilidad de laboratorio
  async getAvailability(id) {
    const query = `
      SELECT * FROM laboratory_availability
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = new LaboratoryRepository();
