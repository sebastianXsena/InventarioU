const Joi = require('joi');

const createValidator = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message).join(', ');
      const err = new Error(message);
      err.name = 'ValidationError';
      err.details = error.details;
      err.statusCode = 400;
      return next(err);
    }

    req[source] = value;
    next();
  };
};

module.exports = { createValidator };
