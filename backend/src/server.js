const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { errorHandler, sanitizeInput } = require('./middleware/errorHandler');
const userRoutes = require('./routes/userRoutes');
const labRoutes = require('./routes/labRoutes');
const itemRoutes = require('./routes/itemRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const programRoutes = require('./routes/programRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true,
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(sanitizeInput);

// Serve the root-level frontend/ (InventarioU/frontend) instead of backend/public
const FRONTEND_DIR = path.join(__dirname, '../../frontend');
app.use(express.static(FRONTEND_DIR));

app.use('/api/auth', userRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/faculties', facultyRoutes);
app.use('/api/programs', programRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n[SERVER] Running on http://localhost:${PORT}`);
  console.log(`[ENV] ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
