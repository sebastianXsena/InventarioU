const itemService = require('../services/ItemService');

const create = async (req, res, next) => {
  try {
    const item = await itemService.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const items = await itemService.getAll();
    res.json(items);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const item = await itemService.getById(req.params.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const getByLabId = async (req, res, next) => {
  try {
    const items = await itemService.getByLabId(req.params.labId);
    res.json(items);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const item = await itemService.update(req.params.id, req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await itemService.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const getUsageStats = async (req, res, next) => {
  try {
    const stats = await itemService.getUsageStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = { create, getAll, getById, getByLabId, update, remove, getUsageStats };
