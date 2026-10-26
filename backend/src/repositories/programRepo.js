const db = require('../config/database');

class ProgramRepo {
  async create({ name, faculty_id }) {
    const res = await db.query(
      `INSERT INTO programs (name, faculty_id)
       VALUES ($1, $2)
       RETURNING *`,
      [name, faculty_id]
    );
    return res.rows[0];
  }

  async getAll() {
    const res = await db.query(
      `SELECT p.id, p.name, p.faculty_id, f.name as faculty_name, p.created_at, p.updated_at
       FROM programs p
       JOIN faculties f ON p.faculty_id = f.id
       ORDER BY p.name ASC`
    );
    return res.rows;
  }

  async getById(id) {
    const res = await db.query(
      `SELECT * FROM programs WHERE id = $1`,
      [id]
    );
    return res.rows[0];
  }

  async getByFacultyId(faculty_id) {
    const res = await db.query(
      `SELECT p.id, p.name, p.faculty_id, f.name as faculty_name, p.created_at, p.updated_at
       FROM programs p
       JOIN faculties f ON p.faculty_id = f.id
       WHERE p.faculty_id = $1
       ORDER BY p.name ASC`,
      [faculty_id]
    );
    return res.rows;
  }

  async update(id, { name, faculty_id }) {
    const res = await db.query(
      `UPDATE programs
       SET name = COALESCE($1, name),
           faculty_id = COALESCE($2, faculty_id)
       WHERE id = $3
       RETURNING *`,
      [name, faculty_id, id]
    );
    return res.rows[0];
  }

  async delete(id) {
    const res = await db.query(
      `DELETE FROM programs WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.rows[0];
  }
}

module.exports = new ProgramRepo();
