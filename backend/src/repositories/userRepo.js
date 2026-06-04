const db = require('../config/database');

class UserRepository {
  async create({ full_name, email, passwordHash, role, faculty_id, program_id, semester }) {
    const query = `
      INSERT INTO users (full_name, email, password_hash, role, faculty_id, program_id, semester)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, full_name, email, role, faculty_id, program_id, semester, created_at
    `;
    const { rows } = await db.query(query, [full_name, email, passwordHash, role, faculty_id || null, program_id || null, semester || null]);
    return rows[0];
  }

  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await db.query(query, [email]);
    return rows[0] || null;
  }

  async findById(id) {
    const query = 'SELECT id, full_name, email, role, faculty_id, program_id, semester, created_at FROM users WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }

  async findAll() {
    const query = 'SELECT id, full_name, email, role, faculty_id, program_id, semester, created_at FROM users ORDER BY created_at DESC';
    const { rows } = await db.query(query);
    return rows;
  }
}

module.exports = new UserRepository();
