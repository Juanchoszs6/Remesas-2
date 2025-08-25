import "dotenv/config"
import xlsx from "xlsx"
import { Client } from "pg"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log("🚀 Iniciando importación completa desde archivos Excel...")

async function crearTablasSiNoExisten(client) {
  console.log("🔧 Verificando y creando tablas si es necesario...")

  // Crear tabla proveedores
  await client.query(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(50) UNIQUE NOT NULL,
      nombre VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_proveedores_codigo ON proveedores(codigo);
    CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
  `)

  // Crear tabla productos
  await client.query(`
    CREATE TABLE IF NOT EXISTS productos (
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

  console.log("✅ Tablas verificadas/creadas exitosamente")
}

async function importarProveedores(client) {
  console.log("\n📋 === IMPORTANDO PROVEEDORES ===")

  try {
    const excelPath = path.join(__dirname, "..", "Proveedores.xlsx")
    const workbook = xlsx.readFile(excelPath)
    const hoja = workbook.Sheets[workbook.SheetNames[0]]
    const data = xlsx.utils.sheet_to_json(hoja)

    console.log(`📊 Proveedores encontrados: ${data.length}`)

    let insertados = 0
    let actualizados = 0
    let errores = 0

    for (const proveedor of data) {
      const codigo = proveedor.Codigo_Prov?.toString().trim()
      const nombre = proveedor.Nombre_Prov?.toString().trim()

      if (codigo && nombre) {
        try {
          const result = await client.query(
            `INSERT INTO proveedores (codigo, nombre) 
             VALUES ($1, $2) 
             ON CONFLICT (codigo) DO UPDATE SET 
             nombre = EXCLUDED.nombre,
             updated_at = CURRENT_TIMESTAMP
             RETURNING (xmax = 0) AS inserted`,
            [codigo, nombre],
          )

          if (result.rows[0].inserted) {
            insertados++
          } else {
            actualizados++
          }

          if ((insertados + actualizados) % 10 === 0) {
            console.log(`✅ Proveedores procesados: ${insertados + actualizados}/${data.length}`)
          }
        } catch (error) {
          errores++
          console.log(`❌ Error con proveedor ${codigo}: ${error.message}`)
        }
      } else {
        errores++
      }
    }

    console.log(`✅ Proveedores insertados: ${insertados}`)
    console.log(`🔄 Proveedores actualizados: ${actualizados}`)
    console.log(`❌ Errores en proveedores: ${errores}`)
    return { insertados, actualizados, errores }
  } catch (error) {
    console.error("💥 Error importando proveedores:", error.message)
    return { insertados: 0, actualizados: 0, errores: 1 }
  }
}

async function importarProductos(client) {
  console.log("\n🛍️ === IMPORTANDO PRODUCTOS ===")

  try {
    const excelPath = path.join(__dirname, "..", "Productos.xlsx")
    const workbook = xlsx.readFile(excelPath)
    const hoja = workbook.Sheets[workbook.SheetNames[0]]
    const data = xlsx.utils.sheet_to_json(hoja)

    console.log(`📊 Productos encontrados: ${data.length}`)

    let insertados = 0
    let actualizados = 0
    let errores = 0

    for (const producto of data) {
      const codigo = producto.Codigo_Prod?.toString().trim()
      const nombre = producto.Nombre_Prod?.toString().trim()
      const precio = producto.Precio_Base ? Number.parseFloat(producto.Precio_Base) : 0
      const tieneIva = producto.Tiene_IVA !== false

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
          } else {
            actualizados++
          }

          if ((insertados + actualizados) % 10 === 0) {
            console.log(`✅ Productos procesados: ${insertados + actualizados}/${data.length}`)
          }
        } catch (error) {
          errores++
          console.log(`❌ Error con producto ${codigo}: ${error.message}`)
        }
      } else {
        errores++
      }
    }

    console.log(`✅ Productos insertados: ${insertados}`)
    console.log(`🔄 Productos actualizados: ${actualizados}`)
    console.log(`❌ Errores en productos: ${errores}`)
    return { insertados, actualizados, errores }
  } catch (error) {
    console.error("💥 Error importando productos:", error.message)
    return { insertados: 0, actualizados: 0, errores: 1 }
  }
}

async function main() {
  try {
    // Conexión a PostgreSQL (Neon)
    console.log("🔌 Conectando a la base de datos Neon...")
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    })

    await client.connect()
    console.log("✅ Conexión establecida con Neon")

    // Crear tablas si no existen
    await crearTablasSiNoExisten(client)

    // Importar proveedores
    const resultProveedores = await importarProveedores(client)

    // Importar productos
    const resultProductos = await importarProductos(client)

    await client.end()

    // Resumen final
    console.log("\n🎉 === RESUMEN FINAL ===")
    console.log(`📋 Proveedores insertados: ${resultProveedores.insertados}`)
    console.log(`📋 Proveedores actualizados: ${resultProveedores.actualizados}`)
    console.log(`🛍️ Productos insertados: ${resultProductos.insertados}`)
    console.log(`🛍️ Productos actualizados: ${resultProductos.actualizados}`)
    console.log(`❌ Total errores: ${resultProveedores.errores + resultProductos.errores}`)
    console.log("✅ Importación completa finalizada")

    console.log("\n📍 INSTRUCCIONES PARA USAR:")
    console.log("1. Los archivos Excel deben estar en la raíz del proyecto")
    console.log("2. Proveedores.xlsx debe tener columnas: Codigo_Prov, Nombre_Prov")
    console.log("3. Productos.xlsx debe tener columnas: Codigo_Prod, Nombre_Prod, Precio_Base, Tiene_IVA")
    console.log("4. El autocompletado ya funcionará con estos datos")
  } catch (error) {
    console.error("💥 Error general:", error.message)
    process.exit(1)
  }
}

main()
