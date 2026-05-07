const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const {
  authMiddleware,
  errorHandler,
  requestLogger,
} = require('./src/middlewares');

// Importar rutas
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const laboratoryRoutes = require('./src/routes/laboratoryRoutes');
const itemRoutes = require('./src/routes/itemRoutes');
const reservationRoutes = require('./src/routes/reservationRoutes');

const app = express();

// ============================================================================
// MIDDLEWARES DE SEGURIDAD
// ============================================================================

// Helmet para headers de seguridad
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));

// ============================================================================
// MIDDLEWARES DE PARSING
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// MIDDLEWARES DE LOGGING
// ============================================================================

app.use(requestLogger);

// ============================================================================
// RUTAS DE SALUD
// ============================================================================

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// Autenticación (pública)
app.use('/api/v1/auth', authRoutes);

// Usuarios
app.use('/api/v1/users', userRoutes);

// Laboratorios
app.use('/api/v1/laboratories', laboratoryRoutes);

// Items/Materiales
app.use('/api/v1/items', itemRoutes);

// Reservas
app.use('/api/v1/reservations', reservationRoutes);

// ============================================================================
// MANEJO DE ERRORES
// ============================================================================

// 404 - Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware de manejo de errores global
app.use(errorHandler);

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📝 Documentación: http://localhost:${PORT}/api-docs`);
  console.log(`💚 Status: http://localhost:${PORT}/health`);
});

module.exports = app;
