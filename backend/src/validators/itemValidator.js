const Joi = require('joi');

// Validación para crear item/material
const createItemSchema = Joi.object({
  lab_id: Joi.string().uuid().required(),
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).optional(),
  total_stock: Joi.number().integer().min(0).required().messages({
    'number.min': 'El stock total no puede ser negativo',
  }),
  reorder_level: Joi.number().integer().min(0).optional(),
});

// Validación para actualizar item
const updateItemSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  total_stock: Joi.number().integer().min(0).optional(),
  available_stock: Joi.number().integer().min(0).optional(),
  reorder_level: Joi.number().integer().min(0).optional(),
});

module.exports = {
  createItemSchema,
  updateItemSchema,
};
