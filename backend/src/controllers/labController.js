const labService = require('../services/labService');

const create = async (req, res, next) => {
  try {
    const lab = await labService.create(req.body);
    res.status(201).json(lab);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const labs = await labService.getAll();
    res.json(labs);
  } catch (error) {
    next(error);
  }
};

const getActive = async (req, res, next) => {
  try {
    const labs = await labService.getActive();
    res.json(labs);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const lab = await labService.getById(req.params.id);
    res.json(lab);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const lab = await labService.update(req.params.id, req.body);
    res.json(lab);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await labService.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = { create, getAll, getActive, getById, update, remove };
