-- Script para crear la tabla activos en Neon PostgreSQL
-- Ejecutar este script directamente en la consola de Neon

-- 1. Crear la tabla activos
CREATE TABLE IF NOT EXISTS activos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_activos_codigo ON activos(codigo);
CREATE INDEX IF NOT EXISTS idx_activos_nombre ON activos(nombre);

-- 3. Insertar los 4 registros de activos fijos
INSERT INTO activos (codigo, nombre) VALUES 
('1', 'Equipo de computacion'),
('2', 'Muebles y enseres'),
('3', 'Muebles y enseres'),
('15923501', 'Flota y equipo de transporte')
ON CONFLICT (codigo) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    updated_at = CURRENT_TIMESTAMP;

-- 4. Verificar que los datos se insertaron correctamente
SELECT 'Datos insertados en tabla activos:' as info;
SELECT id, codigo, nombre, created_at FROM activos ORDER BY id;
