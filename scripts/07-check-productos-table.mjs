import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Client } = pg;
dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function checkProductosTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // 1. Buscar todas las tablas que contengan 'productos'
    console.log('\n🔍 Buscando tablas relacionadas con productos...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%productos%'
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas encontradas:');
    tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));

    // 2. Si encontramos tablas, verificar su estructura
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      console.log(`\n📊 Estructura de la tabla "${tableName}":`);
      
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      console.table(columnsResult.rows);

      // 3. Contar registros
      const countResult = await client.query(`SELECT COUNT(*) as total FROM ${tableName}`);
      console.log(`📊 Total de registros en ${tableName}: ${countResult.rows[0].total}`);

      // 4. Mostrar algunos registros de ejemplo
      if (parseInt(countResult.rows[0].total) > 0) {
        const sampleResult = await client.query(`SELECT * FROM ${tableName} LIMIT 5`);
        console.log(`\n📝 Primeros 5 registros de ${tableName}:`);
        console.table(sampleResult.rows);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

// Ejecutar el script
checkProductosTable();
