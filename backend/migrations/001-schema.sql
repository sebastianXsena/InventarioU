-- ============================================================================
-- SCHEMA DE BASE DE DATOS - PLATAFORMA DE RESERVA DE LABORATORIOS
-- ============================================================================

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLA: Users
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('admin', 'student')) NOT NULL DEFAULT 'student',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- TABLA: Laboratories
-- ============================================================================
CREATE TABLE laboratories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  location VARCHAR(255) NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  status VARCHAR(20) CHECK (status IN ('active', 'maintenance')) DEFAULT 'active',
  blocked_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_laboratories_status ON laboratories(status);

-- ============================================================================
-- TABLA: Items (Inventario de Materiales)
-- ============================================================================
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lab_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  total_stock INT NOT NULL CHECK (total_stock >= 0),
  available_stock INT NOT NULL CHECK (available_stock >= 0),
  reorder_level INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lab_id, name)
);

CREATE INDEX idx_items_lab_id ON items(lab_id);
CREATE INDEX idx_items_available_stock ON items(available_stock);

-- ============================================================================
-- TABLA: Reservations (Solicitudes de Reserva)
-- ============================================================================
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')) DEFAULT 'pending',
  rejection_reason TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_time > start_time),
  CHECK (start_time > CURRENT_TIMESTAMP)
);

CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_lab_id ON reservations(lab_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_start_time ON reservations(start_time);

-- ============================================================================
-- TABLA: Reservation_Items (Relación muchos a muchos: Reservaciones - Items)
-- ============================================================================
CREATE TABLE reservation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity_requested INT NOT NULL CHECK (quantity_requested > 0),
  quantity_used INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reservation_id, item_id)
);

CREATE INDEX idx_reservation_items_reservation_id ON reservation_items(reservation_id);
CREATE INDEX idx_reservation_items_item_id ON reservation_items(item_id);

-- ============================================================================
-- TABLA: Stock_Transactions (Auditoría de cambios en inventario)
-- ============================================================================
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) CHECK (transaction_type IN ('reservation_approved', 'reservation_cancelled', 'manual_adjustment', 'restock')) NOT NULL,
  quantity_change INT NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_transactions_item_id ON stock_transactions(item_id);
CREATE INDEX idx_stock_transactions_created_at ON stock_transactions(created_at);

-- ============================================================================
-- TABLA: Audit_Log (Auditoría general del sistema)
-- ============================================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- Vista: Disponibilidad de laboratorios
CREATE VIEW laboratory_availability AS
SELECT 
  l.id,
  l.name,
  l.capacity,
  COUNT(DISTINCT r.id) as reserved_slots,
  (l.capacity - COUNT(DISTINCT r.id)) as available_slots
FROM laboratories l
LEFT JOIN reservations r ON l.id = r.lab_id 
  AND r.status = 'approved'
  AND r.start_time > CURRENT_TIMESTAMP
GROUP BY l.id, l.name, l.capacity;

-- Vista: Inventario por laboratorio con porcentaje de uso
CREATE VIEW item_usage_stats AS
SELECT 
  i.id,
  i.lab_id,
  i.name,
  i.total_stock,
  i.available_stock,
  (i.total_stock - i.available_stock) as used_stock,
  ROUND((100.0 * (i.total_stock - i.available_stock) / NULLIF(i.total_stock, 0)), 2) as usage_percentage,
  COUNT(ri.id) as total_reservations
FROM items i
LEFT JOIN reservation_items ri ON i.id = ri.item_id
GROUP BY i.id, i.lab_id, i.name, i.total_stock, i.available_stock;

-- ============================================================================
-- FUNCIONES TRIGGER
-- ============================================================================

-- Función para actualizar el timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_laboratories_updated_at BEFORE UPDATE ON laboratories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DATOS INICIALES (SEED)
-- ============================================================================

-- Crear usuario admin (contraseña: admin123 - debe ser hasheada en la aplicación)
INSERT INTO users (name, email, role, password) 
VALUES ('Admin', 'admin@laboratorio.com', 'admin', 'hashed_password');

-- Crear laboratorios de ejemplo
INSERT INTO laboratories (name, location, capacity, description) 
VALUES 
  ('Laboratorio de Programación 1', 'Edificio A - Piso 2', 30, 'Laboratorio con 30 estaciones de trabajo para cursos de programación'),
  ('Laboratorio de Programación 2', 'Edificio A - Piso 3', 25, 'Laboratorio especial para proyectos avanzados'),
  ('Laboratorio de Redes', 'Edificio B - Piso 1', 20, 'Laboratorio con equipos para prácticas de redes');

-- Crear items/inventario de ejemplo
INSERT INTO items (lab_id, name, description, total_stock, available_stock) 
SELECT id, 'Monitor', 'Monitor Full HD 24 pulgadas', 30, 30
FROM laboratories WHERE name = 'Laboratorio de Programación 1'
UNION ALL
SELECT id, 'Teclado', 'Teclado mecánico RGB', 30, 30
FROM laboratories WHERE name = 'Laboratorio de Programación 1'
UNION ALL
SELECT id, 'Ratón', 'Ratón óptico USB', 30, 30
FROM laboratories WHERE name = 'Laboratorio de Programación 1'
UNION ALL
SELECT id, 'Cable de Red', 'Cable Ethernet Cat6 2m', 50, 50
FROM laboratories WHERE name = 'Laboratorio de Redes'
UNION ALL
SELECT id, 'Switch de Red', 'Switch Cisco 24 puertos', 3, 3
FROM laboratories WHERE name = 'Laboratorio de Redes';

-- ============================================================================
-- GRANTS DE PERMISOS (Ejemplo - Ajustar según necesidad)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
