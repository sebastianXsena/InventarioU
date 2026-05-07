const Joi = require('joi');
const { isNotPast } = require('../utils/validation');

// Validación para crear reserva
const createReservationSchema = Joi.object({
  lab_id: Joi.string().uuid().required().messages({
    'string.guid': 'ID de laboratorio inválido',
  }),
  start_time: Joi.date().greater('now').required().messages({
    'date.base': 'Fecha de inicio inválida',
    'date.greater': 'La fecha de inicio debe ser en el futuro',
  }),
  end_time: Joi.date().greater(Joi.ref('start_time')).required().messages({
    'date.greater': 'La fecha final debe ser posterior a la de inicio',
  }),
  items: Joi.array().items(
    Joi.object({
      item_id: Joi.string().uuid().required(),
      quantity_requested: Joi.number().integer().min(1).required().messages({
        'number.min': 'La cantidad debe ser mayor a 0',
      }),
    })
  ).required(),
}).required();

// Validación para actualizar estado de reserva
const updateReservationStatusSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected', 'cancelled').required(),
  rejection_reason: Joi.string().when('status', {
    is: 'rejected',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

module.exports = {
  createReservationSchema,
  updateReservationStatusSchema,
};
