const itemRepo = require('../repositories/itemRepo');
const labRepo = require('../repositories/labRepo');

class ItemService {
  async create(data) {
    const labId = data?.labId ?? data?.lab_id;
    const totalStock = data?.totalStock ?? data?.total_stock;
    const normalized = {
      name: data?.name,
      description: data?.description,
      totalStock,
      labId,
    };

    const lab = await labRepo.findById(labId);
    if (!lab) {
      const err = new Error('Laboratory not found');
      err.statusCode = 404;
      throw err;
    }
    return itemRepo.create(normalized);
  }

  async getAll() {
    return itemRepo.findAll();
  }

  async getById(id) {
    const item = await itemRepo.findById(id);
    if (!item) {
      const err = new Error('Item not found');
      err.statusCode = 404;
      throw err;
    }
    return item;
  }

  async getByLabId(labId) {
    return itemRepo.findByLabId(labId);
  }

  async update(id, data) {
    await this.getById(id);
    const normalized = {
      name: data?.name,
      description: data?.description,
      totalStock: data?.totalStock ?? data?.total_stock,
    };
    return itemRepo.update(id, normalized);
  }

  async delete(id) {
    await this.getById(id);
    return itemRepo.delete(id);
  }

  async getUsageStats() {
    return itemRepo.getUsageStats();
  }
}

module.exports = new ItemService();
