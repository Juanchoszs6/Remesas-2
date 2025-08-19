import "dotenv/config"
import xlsx from "xlsx"
import { Client } from "pg"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log("🚀 Iniciando importación de productos desde Excel...")

try {
  // Buscar el archivo Excel en la raíz del proyecto
  const excelPath = path.join(__dirname, "..", "Productos.xlsx")

  console.log(`📖 Buscando archivo en: ${excelPath}`)

  // Leer el archivo Excel
  const workbook = xlsx.readFile(excelPath)
  const hoja = workbook.Sheets[workbook.SheetNames[0]]
  const data = xlsx.utils.sheet_to_json(hoja)

  console.log(`📊 Se encontraron ${data.length} registros en el Excel`)
  console.log(`📋 Columnas detectadas:`, Object.keys(data[0] || {}))

  // Conexión a PostgreSQL (Neon)
  console.log("🔌 Conectando a la base de datos Neon...")
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // necesario para Neon
    },
  })

  await client.connect()
  console.log("✅ Conexión establecida con Neon")

  // Verificar que la tabla existe
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'productos'
    );
  `)

  if (!tableCheck.rows[0].exists) {
    console.log("⚠️  Tabla 'productos' no existe. Creándola...")
    await client.query(`
      CREATE TABLE productos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        precio_base DECIMAL(10,2) DEFAULT 0,
        tiene_iva BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);
      CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
    `)
    console.log("✅ Tabla 'productos' creada exitosamente")
  }

  // Contador de registros procesados
  let insertados = 0
  let actualizados = 0
  let errores = 0

  // Procesar cada producto
  for (const [index, producto] of data.entries()) {
    const codigo = producto.Codigo_Prod?.toString().trim()
    const nombre = producto.Nombre_Prod?.toString().trim()
    const precio = producto.Precio_Base ? Number.parseFloat(producto.Precio_Base) : 0
    const tieneIva = producto.Tiene_IVA !== false // por defecto true

    if (codigo && nombre) {
      try {
        const result = await client.query(
          `INSERT INTO productos (codigo, nombre, precio_base, tiene_iva) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (codigo) DO UPDATE SET 
           nombre = EXCLUDED.nombre, 
           precio_base = EXCLUDED.precio_base, 
           tiene_iva = EXCLUDED.tiene_iva,
           updated_at = CURRENT_TIMESTAMP
           RETURNING (xmax = 0) AS inserted`,
          [codigo, nombre, precio, tieneIva],
        )

        if (result.rows[0].inserted) {
          insertados++
          console.log(`✅ ${insertados + actualizados}/${data.length} - Insertado: ${codigo} - ${nombre}`)
        } else {
          actualizados++
          console.log(`🔄 ${insertados + actualizados}/${data.length} - Actualizado: ${codigo} - ${nombre}`)
        }
      } catch (error) {
        errores++
        console.log(`❌ Error procesando ${codigo}: ${error.message}`)
      }
    } else {
      errores++
      console.log(`⚠️  Datos incompletos en fila ${index + 2}:`, { codigo, nombre })
    }
  }

  await client.end()

  console.log("\n📊 RESUMEN DE IMPORTACIÓN DE PRODUCTOS:")
  console.log(`✅ Productos insertados: ${insertados}`)
  console.log(`🔄 Productos actualizados: ${actualizados}`)
  console.log(`❌ Errores: ${errores}`)
  console.log(`📝 Total procesados: ${data.length}`)
  console.log("🎉 Importación de productos finalizada")
} catch (error) {
  console.error("💥 Error general:", error.message)
  console.error("📍 Asegúrate de que:")
  console.error("   - El archivo 'Productos.xlsx' esté en la raíz del proyecto")
  console.error("   - Las columnas se llamen: Codigo_Prod, Nombre_Prod, Precio_Base, Tiene_IVA")
  console.error("   - La variable DATABASE_URL esté configurada correctamente")
  process.exit(1)
}
