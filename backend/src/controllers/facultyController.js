const facultyRepo = require('../repositories/facultyRepo');

class FacultyController {
  async getAll(req, res, next) {
    try {
      const faculties = await facultyRepo.getAll();
      res.json(faculties);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const faculty = await facultyRepo.getById(id);
      if (!faculty) return res.status(404).json({ error: 'Facultad no encontrada' });
      res.json(faculty);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

      const faculty = await facultyRepo.create({ name });
      res.status(201).json(faculty);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const faculty = await facultyRepo.update(id, { name });
      if (!faculty) return res.status(404).json({ error: 'Facultad no encontrada' });

      res.json(faculty);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const faculty = await facultyRepo.delete(id);
      if (!faculty) return res.status(404).json({ error: 'Facultad no encontrada' });

      res.json({ message: 'Facultad eliminada exitosamente' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FacultyController();
