import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Client } = pg;
dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function cleanupActivosFijos() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // 1. Mostrar contenido actual
    console.log('\n📋 Contenido actual de activos_fijos_:');
    const currentData = await client.query('SELECT * FROM activos_fijos_');
    console.table(currentData.rows);

    // 2. Eliminar el registro de prueba
    console.log('\n🗑️ Eliminando registro de prueba...');
    const deleteResult = await client.query(
      `DELETE FROM activos_fijos_ 
       WHERE codigo = 'PRUEBA123' AND nombre = 'ACTIVO PRUEBA'`
    );
    console.log(`✅ Registros eliminados: ${deleteResult.rowCount}`);

    // 3. Verificar que se eliminó
    console.log('\n🔍 Verificando registros restantes...');
    const remainingData = await client.query('SELECT COUNT(*) as total FROM activos_fijos_');
    console.log(`📊 Total de registros restantes: ${remainingData.rows[0].total}`);

    // 4. Preguntar si eliminar la tabla completa
    console.log('\n❓ ¿Quieres eliminar la tabla activos_fijos_ completamente?');
    console.log('   Si la tabla no es necesaria, puedes eliminarla ejecutando:');
    console.log('   DROP TABLE IF EXISTS activos_fijos_;');

    // 5. Mostrar tablas existentes
    console.log('\n📋 Tablas existentes en el esquema público:');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    console.log('\n✅ Limpieza completada exitosamente');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error.message);
  } finally {
    await client.end();
  }
}

// Ejecutar el script
cleanupActivosFijos();
