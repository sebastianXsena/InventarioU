-- =============================================
-- LAB RESERVATION SYSTEM - PostgreSQL Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Required for GiST exclusion constraints involving equality on non-range types (e.g. UUID)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'student')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- =============================================
-- LABORATORIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS laboratories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    location VARCHAR(200) NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance')),
    blocked_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_laboratories_status ON laboratories(status);

-- If the table already existed from an older schema, add the column.
ALTER TABLE laboratories
    ADD COLUMN IF NOT EXISTS blocked_schedule JSONB NOT NULL DEFAULT '[]'::jsonb;

-- =============================================
-- ITEMS TABLE (Inventory per Laboratory)
-- =============================================
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    total_stock INTEGER NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
    available_stock INTEGER NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
    lab_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_stock_consistency CHECK (available_stock <= total_stock)
);

CREATE INDEX idx_items_lab_id ON items(lab_id);
CREATE INDEX idx_items_available ON items(available_stock);

-- =============================================
-- RESERVATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    lab_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE RESTRICT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_time_validity CHECK (end_time > start_time),
    CONSTRAINT chk_future_reservation CHECK (start_time > CURRENT_TIMESTAMP)
);

CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_lab_id ON reservations(lab_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_time ON reservations(start_time, end_time);

-- Prevent overlapping reservations per lab (exclusion constraint)
ALTER TABLE reservations ADD CONSTRAINT no_overlapping_reservations
    EXCLUDE USING gist (
        lab_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status IN ('approved'));

-- =============================================
-- RESERVATION_ITEMS TABLE (Many-to-Many)
-- =============================================
CREATE TABLE IF NOT EXISTS reservation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity_used INTEGER NOT NULL CHECK (quantity_used > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reservation_item UNIQUE (reservation_id, item_id)
);

CREATE INDEX idx_reservation_items_reservation ON reservation_items(reservation_id);
CREATE INDEX idx_reservation_items_item ON reservation_items(item_id);

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_laboratories_updated_at BEFORE UPDATE ON laboratories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VIEW: Monthly Report Base
-- =============================================
CREATE OR REPLACE VIEW v_monthly_report AS
SELECT
    r.id AS reservation_id,
    u.name AS user_name,
    u.email AS user_email,
    l.name AS lab_name,
    l.location AS lab_location,
    r.start_time,
    r.end_time,
    EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600 AS duration_hours,
    r.status,
    r.created_at,
    COALESCE(
        json_agg(
            json_build_object(
                'item_name', i.name,
                'quantity', ri.quantity_used,
                'total_stock', i.total_stock
            )
        ) FILTER (WHERE ri.id IS NOT NULL),
        '[]'::json
    ) AS items_used
FROM reservations r
JOIN users u ON r.user_id = u.id
JOIN laboratories l ON r.lab_id = l.id
LEFT JOIN reservation_items ri ON r.id = ri.reservation_id
LEFT JOIN items i ON ri.item_id = i.id
GROUP BY r.id, u.name, u.email, l.name, l.location, r.start_time, r.end_time, r.status, r.created_at;

-- =============================================
-- VIEW: Item Usage Statistics
-- =============================================
CREATE OR REPLACE VIEW v_item_usage AS
SELECT
    i.id AS item_id,
    i.name AS item_name,
    l.name AS lab_name,
    l.id AS lab_id,
    i.total_stock,
    i.available_stock,
    COUNT(ri.id) AS times_reserved,
    COALESCE(SUM(ri.quantity_used), 0) AS total_quantity_used,
    ROUND(
        CASE WHEN i.total_stock > 0
            THEN (COUNT(ri.id)::decimal / NULLIF(COUNT(*) OVER (PARTITION BY l.id), 0)) * 100
            ELSE 0
        END, 2
    ) AS usage_percentage
FROM items i
JOIN laboratories l ON i.lab_id = l.id
LEFT JOIN reservation_items ri ON i.id = ri.item_id
LEFT JOIN reservations r ON ri.reservation_id = r.id AND r.status = 'approved'
GROUP BY i.id, i.name, l.name, l.id, i.total_stock, i.available_stock;
