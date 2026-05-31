const Joi = require('joi');

const timeHHMM = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);
const blockedScheduleEntry = Joi.object({
  day_of_week: Joi.number().integer().min(1).max(7).required(), // 1=Mon ... 7=Sun
  start: timeHHMM.required(),
  end: timeHHMM.required(),
  name: Joi.string().max(120).allow('').trim().optional(),
}).custom((value, helpers) => {
  const [sh, sm] = String(value.start).split(':').map((n) => parseInt(n, 10));
  const [eh, em] = String(value.end).split(':').map((n) => parseInt(n, 10));
  const startMin = (sh * 60) + sm;
  const endMin = (eh * 60) + em;
  if (!(endMin > startMin)) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'start/end ordering');

const userSchema = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required().trim(),
    email: Joi.string().email().required().lowercase().trim(),
    password: Joi.string().min(8).max(128).required(),
    role: Joi.string().valid('student', 'admin').default('student'),
  }),
  login: Joi.object({
    email: Joi.string().email().required().lowercase().trim(),
    password: Joi.string().required(),
  }),
};

const labSchema = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required().trim(),
    location: Joi.string().min(2).max(200).required().trim(),
    capacity: Joi.number().integer().min(1).required(),
    status: Joi.string().valid('active', 'maintenance').default('active'),
    blocked_schedule: Joi.array().items(blockedScheduleEntry).default([]),
  }),
  update: Joi.object({
    name: Joi.string().min(2).max(100).trim(),
    location: Joi.string().min(2).max(200).trim(),
    capacity: Joi.number().integer().min(1),
    status: Joi.string().valid('active', 'maintenance'),
    blocked_schedule: Joi.array().items(blockedScheduleEntry),
  }).min(1),
};

const itemSchema = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required().trim(),
    description: Joi.string().max(500).allow('').trim(),
    total_stock: Joi.number().integer().min(0).required(),
    lab_id: Joi.string().uuid().required(),
  }),
  update: Joi.object({
    name: Joi.string().min(2).max(100).trim(),
    description: Joi.string().max(500).allow('').trim(),
    total_stock: Joi.number().integer().min(0),
  }).min(1),
};

const reservationSchema = {
  create: Joi.object({
    lab_id: Joi.string().uuid().required(),
    start_time: Joi.date().iso().required(),
    end_time: Joi.date().iso().required().greater(Joi.ref('start_time')),
    items: Joi.array().items(
      Joi.object({
        item_id: Joi.string().uuid().required(),
        quantity_used: Joi.number().integer().min(1).required(),
      })
    ).optional(),
    notes: Joi.string().max(500).allow('').trim(),
  }).with('start_time', 'end_time'),
  approveReject: Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
  }),
};

module.exports = {
  userSchema,
  labSchema,
  itemSchema,
  reservationSchema,
};
