const Joi = require('joi');

// Validación para crear laboratorio
const createLaboratorySchema = Joi.object({
  name: Joi.string().min(3).max(255).required().messages({
    'string.empty': 'El nombre del laboratorio es requerido',
  }),
  location: Joi.string().min(3).max(255).required(),
  capacity: Joi.number().integer().min(1).required().messages({
    'number.min': 'La capacidad debe ser mayor a 0',
  }),
  description: Joi.string().max(1000).optional(),
  status: Joi.string().valid('active', 'maintenance').default('active'),
});

// Validación para actualizar laboratorio
const updateLaboratorySchema = Joi.object({
  name: Joi.string().min(3).max(255).optional(),
  location: Joi.string().min(3).max(255).optional(),
  capacity: Joi.number().integer().min(1).optional(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string().valid('active', 'maintenance').optional(),
});

module.exports = {
  createLaboratorySchema,
  updateLaboratorySchema,
};
