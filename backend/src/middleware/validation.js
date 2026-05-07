const { createValidator } = require('../utils/validation');
const { userSchema, labSchema, itemSchema, reservationSchema } = require('../validators');

const validateUserRegister = createValidator(userSchema.register, 'body');
const validateUserLogin = createValidator(userSchema.login, 'body');
const validateLabCreate = createValidator(labSchema.create, 'body');
const validateLabUpdate = createValidator(labSchema.update, 'body');
const validateItemCreate = createValidator(itemSchema.create, 'body');
const validateItemUpdate = createValidator(itemSchema.update, 'body');
const validateReservationCreate = createValidator(reservationSchema.create, 'body');
const validateReservationApprove = createValidator(reservationSchema.approveReject, 'body');

module.exports = {
  validateUserRegister,
  validateUserLogin,
  validateLabCreate,
  validateLabUpdate,
  validateItemCreate,
  validateItemUpdate,
  validateReservationCreate,
  validateReservationApprove,
};
