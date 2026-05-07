const labRepo = require('../repositories/labRepo');

class LabService {
  async create(data) {
    const existing = await labRepo.findAll();
    const duplicate = existing.find((l) => l.name.toLowerCase() === data.name.toLowerCase());
    if (duplicate) {
      const err = new Error('Laboratory with this name already exists');
      err.statusCode = 409;
      throw err;
    }
    return labRepo.create(data);
  }

  async getAll() {
    return labRepo.findAll();
  }

  async getActive() {
    return labRepo.findActive();
  }

  async getById(id) {
    const lab = await labRepo.findById(id);
    if (!lab) {
      const err = new Error('Laboratory not found');
      err.statusCode = 404;
      throw err;
    }
    return lab;
  }

  async update(id, data) {
    await this.getById(id);
    return labRepo.update(id, data);
  }

  async delete(id) {
    await this.getById(id);
    return labRepo.delete(id);
  }
}

module.exports = new LabService();
