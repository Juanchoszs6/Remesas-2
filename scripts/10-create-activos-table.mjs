import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Client } = pg;
dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createActivosTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // Crear la tabla activos si no existe
    console.log('🔧 Creando tabla activos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS activos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_activos_codigo ON activos(codigo);
      CREATE INDEX IF NOT EXISTS idx_activos_nombre ON activos(nombre);
    `);
    console.log('✅ Tabla activos creada exitosamente');

    // Insertar los 4 registros de activos fijos que me mostraste
    console.log('📝 Insertando los 4 activos fijos...');
    
    const activos = [
      { codigo: '1', nombre: 'Equipo de computacion' },
      { codigo: '2', nombre: 'Muebles y enseres' },
      { codigo: '3', nombre: 'Muebles y enseres' },
      { codigo: '15923501', nombre: 'Flota y equipo de transporte' }
    ];

    let insertados = 0;
    for (const activo of activos) {
      try {
        await client.query(
          `INSERT INTO activos (codigo, nombre) 
           VALUES ($1, $2) 
           ON CONFLICT (codigo) DO UPDATE SET 
           nombre = EXCLUDED.nombre,
           updated_at = CURRENT_TIMESTAMP`,
          [activo.codigo, activo.nombre]
        );
        insertados++;
        console.log(`✅ ${insertados}/4 - Insertado: ${activo.codigo} - ${activo.nombre}`);
      } catch (error) {
        console.error(`❌ Error insertando ${activo.codigo}: ${error.message}`);
      }
    }

    // Verificar los datos insertados
    console.log('\n📊 Verificando datos insertados...');
    const result = await client.query('SELECT id, codigo, nombre FROM activos ORDER BY id');
    console.table(result.rows);

    console.log(`\n🎉 Proceso completado. Total de activos: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createActivosTable();
