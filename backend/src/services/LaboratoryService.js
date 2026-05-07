const LaboratoryRepository = require('../repositories/LaboratoryRepository');

class LaboratoryService {
  // Crear laboratorio (admin)
  async createLaboratory(labData) {
    // Validar datos
    if (!labData.name || !labData.location || !labData.capacity) {
      throw new Error('Datos incompletos para crear laboratorio');
    }

    return LaboratoryRepository.create(labData);
  }

  // Obtener laboratorio por ID
  async getLaboratory(id) {
    const lab = await LaboratoryRepository.findById(id);
    if (!lab) {
      throw new Error('Laboratorio no encontrado');
    }

    // Obtener disponibilidad
    const availability = await LaboratoryRepository.getAvailability(id);

    return { ...lab, availability };
  }

  // Obtener todos los laboratorios
  async getLaboratories(limit = 10, offset = 0) {
    const labs = await LaboratoryRepository.findAll(limit, offset);
    const total = await LaboratoryRepository.count();

    // Enriquecer con disponibilidad
    const enrichedLabs = await Promise.all(
      labs.map(async (lab) => {
        const availability = await LaboratoryRepository.getAvailability(lab.id);
        return { ...lab, availability };
      })
    );

    return { labs: enrichedLabs, total };
  }

  // Obtener laboratorios activos
  async getActiveLaboratories(limit = 10, offset = 0) {
    const labs = await LaboratoryRepository.findActive(limit, offset);

    // Enriquecer con disponibilidad
    const enrichedLabs = await Promise.all(
      labs.map(async (lab) => {
        const availability = await LaboratoryRepository.getAvailability(lab.id);
        return { ...lab, availability };
      })
    );

    return enrichedLabs;
  }

  // Actualizar laboratorio (admin)
  async updateLaboratory(id, updateData) {
    const lab = await LaboratoryRepository.findById(id);
    if (!lab) {
      throw new Error('Laboratorio no encontrado');
    }

    return LaboratoryRepository.update(id, updateData);
  }

  // Cambiar estado de laboratorio (admin)
  async changeLaboratoryStatus(id, status) {
    if (!['active', 'maintenance'].includes(status)) {
      throw new Error('Estado inválido');
    }

    const lab = await LaboratoryRepository.findById(id);
    if (!lab) {
      throw new Error('Laboratorio no encontrado');
    }

    return LaboratoryRepository.update(id, { status });
  }

  // Eliminar laboratorio (admin)
  async deleteLaboratory(id) {
    const lab = await LaboratoryRepository.findById(id);
    if (!lab) {
      throw new Error('Laboratorio no encontrado');
    }

    return LaboratoryRepository.delete(id);
  }
}

module.exports = new LaboratoryService();
