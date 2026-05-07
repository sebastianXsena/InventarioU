const LaboratoryService = require('../services/LaboratoryService');
const { createLaboratorySchema, updateLaboratorySchema } = require('../validators/laboratoryValidator');

class LaboratoryController {
  // Crear laboratorio (admin)
  async createLaboratory(req, res, next) {
    try {
      const { error, value } = createLaboratorySchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const lab = await LaboratoryService.createLaboratory(value);

      res.status(201).json({
        message: 'Laboratorio creado exitosamente',
        data: lab,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Obtener laboratorio por ID
  async getLaboratory(req, res, next) {
    try {
      const lab = await LaboratoryService.getLaboratory(req.params.id);

      res.status(200).json({
        data: lab,
      });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  // Obtener todos los laboratorios
  async getLaboratories(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;

      const result = await LaboratoryService.getLaboratories(limit, offset);

      res.status(200).json({
        data: result.labs,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Obtener laboratorios activos
  async getActiveLaboratories(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;

      const labs = await LaboratoryService.getActiveLaboratories(limit, offset);

      res.status(200).json({
        data: labs,
        count: labs.length,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Actualizar laboratorio (admin)
  async updateLaboratory(req, res, next) {
    try {
      const { error, value } = updateLaboratorySchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const lab = await LaboratoryService.updateLaboratory(req.params.id, value);

      res.status(200).json({
        message: 'Laboratorio actualizado',
        data: lab,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Cambiar estado de laboratorio (admin)
  async changeLaboratoryStatus(req, res, next) {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'El estado es requerido' });
      }

      const lab = await LaboratoryService.changeLaboratoryStatus(req.params.id, status);

      res.status(200).json({
        message: 'Estado del laboratorio actualizado',
        data: lab,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Eliminar laboratorio (admin)
  async deleteLaboratory(req, res, next) {
    try {
      const result = await LaboratoryService.deleteLaboratory(req.params.id);

      res.status(200).json({
        message: 'Laboratorio eliminado',
        data: result,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new LaboratoryController();
