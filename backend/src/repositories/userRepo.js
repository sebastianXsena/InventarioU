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

  async updateProfile(id, { full_name, faculty_id, program_id, semester }) {
    const query = `
      UPDATE users 
      SET full_name = $1, faculty_id = $2, program_id = $3, semester = $4
      WHERE id = $5
      RETURNING id, full_name, email, role, faculty_id, program_id, semester, created_at
    `;
    const { rows } = await db.query(query, [full_name, faculty_id || null, program_id || null, semester || null, id]);
    return rows[0] || null;
  }

  async updatePassword(id, passwordHash) {
    const query = 'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id';
    const { rows } = await db.query(query, [passwordHash, id]);
    return rows[0] || null;
  }
}

module.exports = new UserRepository();
