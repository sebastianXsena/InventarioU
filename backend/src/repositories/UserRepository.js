const pool = require('../config/database');

class UserRepository {
  // Crear usuario
  async create(userData) {
    const { name, email, password, role } = userData;
    const query = `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at;
    `;
    const result = await pool.query(query, [name, email, password, role]);
    return result.rows[0];
  }

  // Obtener usuario por email
  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  // Obtener usuario por ID
  async findById(id) {
    const query = 'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Obtener todos los usuarios
  async findAll(limit = 10, offset = 0) {
    const query = 'SELECT id, name, email, role, is_active, created_at FROM users LIMIT $1 OFFSET $2';
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Actualizar usuario
  async update(id, userData) {
    const { name, email, role, is_active } = userData;
    const query = `
      UPDATE users 
      SET name = COALESCE($2, name),
          email = COALESCE($3, email),
          role = COALESCE($4, role),
          is_active = COALESCE($5, is_active)
      WHERE id = $1
      RETURNING id, name, email, role, is_active, created_at;
    `;
    const result = await pool.query(query, [id, name, email, role, is_active]);
    return result.rows[0];
  }

  // Contar total de usuarios
  async count() {
    const query = 'SELECT COUNT(*) FROM users';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count, 10);
  }
}

module.exports = new UserRepository();
