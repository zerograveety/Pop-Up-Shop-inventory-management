-- Database schema for authentication system

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (role_name, description) VALUES 
    ('Admin', 'Full system access - can manage users, products, sales, and orders'),
    ('Manager', 'Can manage products, view orders and reports')
ON CONFLICT (role_name) DO NOTHING;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(role_id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view for user information with role details
CREATE OR REPLACE VIEW user_details AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.role_id,
    r.role_name,
    r.description as role_description,
    u.is_active,
    u.created_at,
    u.updated_at,
    u.last_login
FROM users u
JOIN roles r ON u.role_id = r.role_id;

-- Insert a default admin user (password: 'admin123')
-- Note: This is just for development. In production, create admin through proper registration
INSERT INTO users (name, email, password, role_id) VALUES 
    ('System Admin', 'admin@popup.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBcWHkEXdHxe/G', 1)
ON CONFLICT (email) DO NOTHING;

-- Create permissions table for more granular access control (optional)
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions junction table (optional)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Insert sample permissions (optional)
INSERT INTO permissions (permission_name, description) VALUES 
    ('manage_users', 'Create, update, delete users'),
    ('manage_products', 'Create, update, delete products'),
    ('manage_orders', 'Create, update, delete orders'),
    ('view_reports', 'View sales and inventory reports'),
    ('manage_settings', 'Modify system settings')
ON CONFLICT (permission_name) DO NOTHING;

-- Assign permissions to roles (optional)
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.role_id, p.permission_id 
FROM roles r, permissions p 
WHERE r.role_name = 'Admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.role_id, p.permission_id 
FROM roles r, permissions p 
WHERE r.role_name = 'Manager' AND p.permission_name IN ('manage_products', 'view_reports', 'manage_orders')
ON CONFLICT DO NOTHING;

-- Cashier role removed