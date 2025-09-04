-- Hansei Database Setup Script
-- Run this after creating your PostgreSQL database on Render

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    active BOOLEAN DEFAULT true
);

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    manager VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    material VARCHAR(100) NOT NULL,
    technology VARCHAR(50),
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    product_id INTEGER REFERENCES products(id),
    avl_stock INTEGER DEFAULT 0,
    month_plan INTEGER DEFAULT 0,
    billing INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create upload_history table
CREATE TABLE IF NOT EXISTS upload_history (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id),
    file_size BIGINT,
    records_processed INTEGER,
    status VARCHAR(20) DEFAULT 'completed'
);

-- Insert default users with common demo credentials
-- Password hashes are bcrypt hashes for the respective passwords
INSERT INTO users (username, password, full_name, email, role) VALUES 
-- smartuser / password123
('smartuser', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Smart User', 'smartuser@hansei.com', 'admin'),
-- normaluser / password123  
('normaluser', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Normal User', 'normaluser@hansei.com', 'user'),
-- admin / admin123
('admin', '$2a$10$8K.Q6MKQfGHKU9IiEPZTSes0XUcXb0oBZJvQ7ZNtqLfyT0C8VHI7i', 'Administrator', 'admin@hansei.com', 'admin'),
-- demo / demo123
('demo', '$2a$10$7ZwONGi2nw9.jXU5Zy4D9.bQl4vLKVc6rLfOWO3fZQwIL7gLxCdPS', 'Demo User', 'demo@hansei.com', 'user')
ON CONFLICT (username) DO NOTHING;

-- Insert sample branches
INSERT INTO branches (name, location, manager) VALUES 
('Chennai', 'Chennai, Tamil Nadu', 'Manager A'),
('Bangalore', 'Bangalore, Karnataka', 'Manager B'),
('Mumbai', 'Mumbai, Maharashtra', 'Manager C'),
('Delhi', 'Delhi, India', 'Manager D')
ON CONFLICT DO NOTHING;

-- Insert sample products
INSERT INTO products (material, technology, category) VALUES 
('DAIKIN-AC-1.5T-SPLIT', 'Inverter', 'Air Conditioner'),
('DAIKIN-AC-2T-SPLIT', 'Inverter', 'Air Conditioner'),
('DAIKIN-AC-1T-WINDOW', 'Non-Inverter', 'Air Conditioner'),
('DAIKIN-VRV-SYSTEM', 'VRV', 'Commercial AC')
ON CONFLICT DO NOTHING;

-- Insert sample inventory data
INSERT INTO inventory (branch_id, product_id, avl_stock, month_plan, billing)
SELECT 
    b.id,
    p.id,
    FLOOR(RANDOM() * 100) + 10,  -- Random stock between 10-109
    FLOOR(RANDOM() * 50) + 20,   -- Random plan between 20-69
    FLOOR(RANDOM() * 30) + 5     -- Random billing between 5-34
FROM branches b, products p
ON CONFLICT DO NOTHING;