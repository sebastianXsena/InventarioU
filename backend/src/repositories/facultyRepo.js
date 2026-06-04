const db = require('../config/database');

class FacultyRepo {
  async create({ name }) {
    const res = await db.query(
      `INSERT INTO faculties (name)
       VALUES ($1)
       RETURNING *`,
      [name]
    );
    return res.rows[0];
  }

  async getAll() {
    const res = await db.query(
      `SELECT id, name, created_at, updated_at
       FROM faculties
       ORDER BY name ASC`
    );
    return res.rows;
  }

  async getById(id) {
    const res = await db.query(
      `SELECT * FROM faculties WHERE id = $1`,
      [id]
    );
    return res.rows[0];
  }

  async update(id, { name }) {
    const res = await db.query(
      `UPDATE faculties
       SET name = COALESCE($1, name)
       WHERE id = $2
       RETURNING *`,
      [name, id]
    );
    return res.rows[0];
  }

  async delete(id) {
    const res = await db.query(
      `DELETE FROM faculties WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.rows[0];
  }
}

module.exports = new FacultyRepo();
