# LabReserve - Sistema de Reserva de Laboratorios de Informatica

Plataforma completa para la gestion de reservas de laboratorios de informatica, inventario de materiales y reportes de uso.

## Arquitectura

- **Patrón**: Controller → Service → Repository (Separation of Concerns / SOLID)
- **Frontend**: Vanilla JS (ES6+), HTML5, CSS3 (BEM methodology)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL con transacciones ACID

## Requisitos

- Node.js >= 18
- PostgreSQL >= 14

## Instalacion

### 1. Configurar base de datos

```sql
-- Crear la base de datos
CREATE DATABASE lab_reservations;
```

### 2. Configurar variables de entorno

```bash
cd backend
copy .env.example .env
```

Editar `.env` con las credenciales de PostgreSQL:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lab_reservations
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=un_secreto_seguro_de_al_menos_32_caracteres
```

### 3. Instalar dependencias

```bash
cd backend
npm install
```

### 4. Inicializar base de datos

```bash
npm run db:init
```

### 5. Cargar datos de ejemplo (opcional)

```bash
npm run seed
```

Credenciales de demo:
| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@lab.com | admin123 |
| Student | ana@lab.com | student123 |
| Student | carlos@lab.com | student123 |

### 6. Iniciar servidor

```bash
npm start          # Produccion
npm run dev        # Desarrollo (hot reload)
```

Abrir http://localhost:3000

## Estructura del Proyecto

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # Pool de conexiones PostgreSQL
│   │   └── schema.sql           # Schema completo con constraints
│   ├── controllers/             # Capa de presentacion (HTTP handlers)
│   │   ├── userController.js
│   │   ├── labController.js
│   │   ├── itemController.js
│   │   └── reservationController.js
│   ├── services/                # Capa de logica de negocio
│   │   ├── userService.js
│   │   ├── labService.js
│   │   ├── itemService.js
│   │   └── reservationService.js  # Transacciones SQL aqui
│   ├── repositories/            # Capa de acceso a datos
│   │   ├── userRepo.js
│   │   ├── labRepo.js
│   │   ├── itemRepo.js
│   │   └── reservationRepo.js
│   ├── middleware/
│   │   ├── auth.js              # JWT + Role-based access
│   │   ├── validation.js        # Joi validation middleware
│   │   └── errorHandler.js      # Error handling + sanitization
│   ├── validators/
│   │   └── index.js             # Joi schemas
│   ├── routes/                  # Route definitions
│   └── utils/
│       ├── init-db.js           # Database initialization
│       ├── seed-db.js           # Sample data
│       └── validation.js        # Validation helper
├── public/                      # Frontend
│   ├── index.html
│   ├── css/styles.css           # BEM methodology
│   ├── js/api.js                # API client
│   ├── js/app.js                # Application logic
│   └── report-template.html     # PDF report template
└── docs/
    └── API.md                   # API documentation
```

## API Endpoints

### Autenticacion
| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| POST | `/api/auth/register` | Public | Registrar usuario |
| POST | `/api/auth/login` | Public | Iniciar sesion |
| GET | `/api/auth/me` | Auth | Perfil actual |
| GET | `/api/auth/users` | Admin | Todos los usuarios |

### Laboratorios
| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| GET | `/api/labs` | Public | Todos los labs |
| GET | `/api/labs/active` | Public | Labs activos |
| POST | `/api/labs` | Admin | Crear lab |
| PATCH | `/api/labs/:id` | Admin | Actualizar lab |
| DELETE | `/api/labs/:id` | Admin | Eliminar lab |

### Inventario
| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| GET | `/api/items` | Public | Todos los items |
| GET | `/api/items/stats` | Admin | Estadisticas de uso |
| GET | `/api/items/lab/:labId` | Public | Items por lab |
| POST | `/api/items` | Admin | Crear item |
| PATCH | `/api/items/:id` | Admin | Actualizar item |
| DELETE | `/api/items/:id` | Admin | Eliminar item |

### Reservas
| Metodo | Ruta | Acceso | Descripcion |
|--------|------|--------|-------------|
| GET | `/api/reservations` | Auth | Todas las reservas |
| GET | `/api/reservations/my` | Auth | Mis reservas |
| GET | `/api/reservations/:id` | Auth | Detalle reserva |
| POST | `/api/reservations` | Auth | Crear reserva |
| PATCH | `/api/reservations/:id/approve` | Admin | Aprobar/Rechazar |
| PATCH | `/api/reservations/:id/cancel` | Auth | Cancelar reserva |
| GET | `/api/reservations/report/:year/:month` | Admin | Reporte mensual |

Ver `docs/API.md` para documentacion completa.

## Seguridad

- **JWT**: Tokens con expiracion configurable
- **Role-based Access**: Middleware `authorize('admin')` para rutas protegidas
- **Sanitizacion**: `sanitize-html` para prevenir XSS
- **Validacion**: Joi para validacion estricta de entradas
- **Rate Limiting**: 100 requests por 15 minutos
- **Helmet**: Headers de seguridad HTTP
- **SQL Transactions**: Operaciones criticas dentro de transacciones ACID
- **Exclusion Constraints**: Prevencion de solapamiento a nivel de BD

## Reglas de Negocio

1. **No reservas en el pasado**: Validado en DB (`chk_future_reservation`) y backend
2. **Sin stock = sin reserva**: Validacion de stock antes de crear
3. **Estado PENDIENTE**: No afecta inventario hasta aprobacion
4. **Aprobacion atomica**: Status + stock deduction en una transaccion
5. **Cancelacion**: Restaura stock si estaba aprobada
6. **Sin solapamiento**: Exclusion constraint en PostgreSQL

## Diseño de Base de Datos

### Tablas principales
- **users**: Usuarios con roles (admin/student)
- **laboratories**: Salas con estado (active/maintenance)
- **items**: Inventario por laboratorio con stock tracking
- **reservations**: Reservas con estados (pending/approved/rejected/cancelled)
- **reservation_items**: Many-to-many entre reservas e items

### Constraints
- Foreign keys con ON DELETE CASCADE/RESTRICT
- Check constraints para integridad de stock
- Exclusion constraint para prevenir solapamiento temporal
- Triggers para `updated_at` automatico

### Views
- `v_monthly_report`: Reporte mensual con datos agregados
- `v_item_usage`: Estadisticas de uso por material

## Flujos de Usuario

### Estudiante
1. Ver calendario de disponibilidad
2. Seleccionar lab, fecha, horario y materiales
3. Crear reserva → estado PENDIENTE
4. Ver estado de sus reservas
5. Cancelar reservas pendientes

### Admin
1. Ver solicitudes pendientes
2. Aprobar (descuenta stock) o Rechazar
3. Gestionar laboratorios (crear, activar/desactivar)
4. Gestionar inventario (crear items, ver stock)
5. Generar reportes mensuales

## Licencia

MIT
