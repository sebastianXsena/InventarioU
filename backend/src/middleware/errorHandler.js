const sanitizeHtml = require('sanitize-html');

const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (typeof value === 'object' && value !== null) {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = sanitizeValue(v);
      }
      return out;
    }
    return value;
  };

  if (req.body) req.body = sanitizeValue(req.body);
  next();
};

const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err);

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource not found' });
  }

  if (err.code === '23514') {
    return res.status(400).json({ error: 'Invalid data constraints' });
  }

  if (err.code === '23P01') {
    return res.status(409).json({ error: 'Time slot conflict - laboratory already reserved' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.details?.[0]?.message || 'Validation failed' });
  }

  const status = err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
};

module.exports = { sanitizeInput, errorHandler };
