import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Client } = pg;
dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createProductosUnderscore() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // Crear la tabla productos_ si no existe
    console.log('🔧 Creando tabla productos_...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS productos_ (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_productos_underscore_codigo ON productos_(codigo);
      CREATE INDEX IF NOT EXISTS idx_productos_underscore_nombre ON productos_(nombre);
    `);
    console.log('✅ Tabla productos_ creada exitosamente');

    // Insertar los 5 registros que me mostraste
    console.log('📝 Insertando los 5 productos...');
    
    const productos = [
      { codigo: '1', nombre: 'Producto genérico' },
      { codigo: 'productogenericoncube', nombre: 'Producto genérico del cubo' },
      { codigo: '03', nombre: 'REINTEGRO DE COSTOS Y GASTOS' },
      { codigo: '3', nombre: 'SERVICIO DE TRANSPORTE' },
      { codigo: '2', nombre: 'Servicios profesionales' }
    ];

    let insertados = 0;
    for (const producto of productos) {
      try {
        await client.query(
          `INSERT INTO productos_ (codigo, nombre) 
           VALUES ($1, $2) 
           ON CONFLICT (codigo) DO UPDATE SET 
           nombre = EXCLUDED.nombre,
           updated_at = CURRENT_TIMESTAMP`,
          [producto.codigo, producto.nombre]
        );
        insertados++;
        console.log(`✅ ${insertados}/5 - Insertado: ${producto.codigo} - ${producto.nombre}`);
      } catch (error) {
        console.error(`❌ Error insertando ${producto.codigo}: ${error.message}`);
      }
    }

    // Verificar los datos insertados
    console.log('\n📊 Verificando datos insertados...');
    const result = await client.query('SELECT id, codigo, nombre FROM productos_ ORDER BY id');
    console.table(result.rows);

    console.log(`\n🎉 Proceso completado. Total de productos en productos_: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createProductosUnderscore();
