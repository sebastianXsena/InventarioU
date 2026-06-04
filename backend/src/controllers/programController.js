const programRepo = require('../repositories/programRepo');

class ProgramController {
  async getAll(req, res, next) {
    try {
      const programs = await programRepo.getAll();
      res.json(programs);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const program = await programRepo.getById(id);
      if (!program) return res.status(404).json({ error: 'Programa no encontrado' });
      res.json(program);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { name, faculty_id } = req.body;
      if (!name || !faculty_id) return res.status(400).json({ error: 'Nombre y facultad son obligatorios' });

      const program = await programRepo.create({ name, faculty_id });
      res.status(201).json(program);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, faculty_id } = req.body;

      const program = await programRepo.update(id, { name, faculty_id });
      if (!program) return res.status(404).json({ error: 'Programa no encontrado' });

      res.json(program);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const program = await programRepo.delete(id);
      if (!program) return res.status(404).json({ error: 'Programa no encontrado' });

      res.json({ message: 'Programa eliminado exitosamente' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProgramController();
