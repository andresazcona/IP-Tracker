-- Complete Schema: IP Tracker with Authentication
-- This combines both basic device tracking and authentication schemas

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (in correct order due to dependencies)
DROP TABLE IF EXISTS user_device_assignments CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS device_status CASCADE;
DROP TABLE IF EXISTS ip_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS devices CASCADE;

-- Table: roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role_id UUID NOT NULL REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: refresh_tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: devices (updated with new columns for auth system)
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_name VARCHAR(100) NOT NULL UNIQUE,
    device_type VARCHAR(50) DEFAULT 'raspberry_pi',
    mac_address VARCHAR(17) UNIQUE,
    serial_number VARCHAR(100) UNIQUE,
    model VARCHAR(100),
    location VARCHAR(255),
    notes TEXT,
    description TEXT, -- keep for backward compatibility
    purchase_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: ip_logs
CREATE TABLE ip_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    public_ip INET,
    local_ip INET,
    wifi_network VARCHAR(100),
    port INTEGER,
    user_agent TEXT,
    ping_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'active'
);

-- Table: device_status
CREATE TABLE device_status (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    current_ip INET,
    current_public_ip INET,
    current_local_ip INET,
    current_wifi_network VARCHAR(100),
    last_ping TIMESTAMP WITH TIME ZONE,
    last_online TIMESTAMP WITH TIME ZONE,
    ping_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'offline',
    uptime_percentage DECIMAL(5,2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_device_assignments
CREATE TABLE user_device_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id, is_active) -- Prevent duplicate active assignments
);

-- Table: audit_logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_devices_name ON devices(device_name);
CREATE INDEX idx_devices_active ON devices(is_active);
CREATE INDEX idx_devices_mac ON devices(mac_address);
CREATE INDEX idx_devices_serial ON devices(serial_number);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_role ON users(role_id);

CREATE INDEX idx_ip_logs_device_id ON ip_logs(device_id);
CREATE INDEX idx_ip_logs_timestamp ON ip_logs(ping_timestamp);
CREATE INDEX idx_ip_logs_ip ON ip_logs(ip_address);

CREATE INDEX idx_device_status_last_ping ON device_status(last_ping);
CREATE INDEX idx_device_status_status ON device_status(status);

CREATE INDEX idx_assignments_user ON user_device_assignments(user_id);
CREATE INDEX idx_assignments_device ON user_device_assignments(device_id);
CREATE INDEX idx_assignments_active ON user_device_assignments(is_active);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Function to update device status
CREATE OR REPLACE FUNCTION update_device_status()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO device_status (
        device_id, current_ip, current_public_ip, current_local_ip,
        current_wifi_network, last_ping, last_online, ping_count,
        status, updated_at
    )
    VALUES (
        NEW.device_id, NEW.ip_address, NEW.public_ip, NEW.local_ip,
        NEW.wifi_network, NEW.ping_timestamp, NEW.ping_timestamp, 1,
        'online', CURRENT_TIMESTAMP
    )
    ON CONFLICT (device_id) DO UPDATE SET
        current_ip = NEW.ip_address,
        current_public_ip = NEW.public_ip,
        current_local_ip = NEW.local_ip,
        current_wifi_network = NEW.wifi_network,
        last_ping = NEW.ping_timestamp,
        last_online = NEW.ping_timestamp,
        ping_count = device_status.ping_count + 1,
        status = 'online',
        updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for audit logging
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id UUID,
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
    VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_details, p_ip_address, p_user_agent);
END;
$$ LANGUAGE plpgsql;

-- Function to clean old logs
CREATE OR REPLACE FUNCTION clean_old_ip_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ip_logs 
    WHERE ping_timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to mark offline devices
CREATE OR REPLACE FUNCTION mark_offline_devices_simple()
RETURNS INTEGER AS $$
DECLARE
    offline_threshold INTERVAL := '3 minutes';
    update_count INTEGER := 0;
BEGIN
    UPDATE device_status 
    SET status = 'offline', updated_at = CURRENT_TIMESTAMP
    FROM devices d
    WHERE device_status.device_id = d.id
        AND d.is_active = true 
        AND device_status.status = 'online'
        AND device_status.last_ping < (CURRENT_TIMESTAMP - offline_threshold);
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RETURN update_count;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_device_status
    AFTER INSERT ON ip_logs
    FOR EACH ROW EXECUTE FUNCTION update_device_status();

CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON user_device_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
    ('admin', 'System Administrator', ARRAY[
        'users.create', 'users.read', 'users.update', 'users.delete',
        'devices.create', 'devices.read', 'devices.update', 'devices.delete',
        'assignments.create', 'assignments.read', 'assignments.update', 'assignments.delete',
        'system.manage', 'audit.read'
    ]),
    ('manager', 'Device Manager', ARRAY[
        'users.read', 'devices.create', 'devices.read', 'devices.update',
        'assignments.create', 'assignments.read', 'assignments.update'
    ]),
    ('user', 'Regular User', ARRAY[
        'devices.read.assigned', 'assignments.read.own'
    ]),
    ('viewer', 'Read-only User', ARRAY[
        'devices.read', 'assignments.read'
    ]);

-- Create default admin user (password: admin)
-- Hash: $2b$10$yRoC8Kn3cd70jJOjHpuDCe5N3lr4qfD4uZ7rg4HJlcGy/Z0IHtEUa
INSERT INTO users (username, email, password_hash, first_name, last_name, role_id)
SELECT 'admin', 'admin@localhost', '$2b$10$yRoC8Kn3cd70jJOjHpuDCe5N3lr4qfD4uZ7rg4HJlcGy/Z0IHtEUa', 'System', 'Administrator', r.id
FROM roles r WHERE r.name = 'admin';

-- Views for easier querying
CREATE VIEW device_summary AS
SELECT 
    d.id, d.device_name, d.device_type, d.mac_address, d.serial_number,
    d.model, d.location, d.status, d.is_active, d.created_at,
    ds.current_ip, ds.current_public_ip, ds.current_local_ip,
    ds.current_wifi_network, ds.last_ping, ds.last_online,
    ds.ping_count, ds.status as connection_status, ds.uptime_percentage,
    CASE 
        WHEN ds.last_ping > CURRENT_TIMESTAMP - INTERVAL '10 minutes' THEN 'online'
        WHEN ds.last_ping IS NOT NULL THEN 'offline'
        ELSE 'never_connected'
    END as real_time_status
FROM devices d
LEFT JOIN device_status ds ON d.id = ds.device_id
WHERE d.is_active = true;

CREATE VIEW recent_ip_logs AS
SELECT 
    il.id, d.device_name, d.device_type, il.ip_address,
    il.public_ip, il.local_ip, il.wifi_network,
    il.ping_timestamp, il.response_time_ms, il.status
FROM ip_logs il
JOIN devices d ON il.device_id = d.id
ORDER BY il.ping_timestamp DESC;