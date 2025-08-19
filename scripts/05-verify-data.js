import "dotenv/config"
import { Client } from "pg"

console.log("🔍 Verificando datos importados en la base de datos...")

async function main() {
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    })

    await client.connect()
    console.log("✅ Conexión establecida con Neon")

    // Verificar proveedores
    console.log("\n📋 === VERIFICANDO PROVEEDORES ===")
    const proveedoresResult = await client.query(`
      SELECT COUNT(*) as total,
             MIN(created_at) as primer_registro,
             MAX(created_at) as ultimo_registro
      FROM proveedores
    `)

    const sampleProveedores = await client.query(`
      SELECT codigo, nombre 
      FROM proveedores 
      ORDER BY created_at DESC 
      LIMIT 5
    `)

    console.log(`📊 Total proveedores: ${proveedoresResult.rows[0].total}`)
    console.log(`📅 Primer registro: ${proveedoresResult.rows[0].primer_registro}`)
    console.log(`📅 Último registro: ${proveedoresResult.rows[0].ultimo_registro}`)
    console.log("📝 Últimos 5 proveedores:")
    sampleProveedores.rows.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.codigo} - ${p.nombre}`)
    })

    // Verificar productos
    console.log("\n🛍️ === VERIFICANDO PRODUCTOS ===")
    const productosResult = await client.query(`
      SELECT COUNT(*) as total,
             AVG(precio_base) as precio_promedio,
             COUNT(*) FILTER (WHERE tiene_iva = true) as con_iva,
             COUNT(*) FILTER (WHERE tiene_iva = false) as sin_iva,
             MIN(created_at) as primer_registro,
             MAX(created_at) as ultimo_registro
      FROM productos
    `)

    const sampleProductos = await client.query(`
      SELECT codigo, nombre, precio_base, tiene_iva 
      FROM productos 
      ORDER BY created_at DESC 
      LIMIT 5
    `)

    console.log(`📊 Total productos: ${productosResult.rows[0].total}`)
    console.log(
      `💰 Precio promedio: $${Number.parseFloat(productosResult.rows[0].precio_promedio || 0).toLocaleString("es-CO")} COP`,
    )
    console.log(`✅ Con IVA: ${productosResult.rows[0].con_iva}`)
    console.log(`❌ Sin IVA: ${productosResult.rows[0].sin_iva}`)
    console.log(`📅 Primer registro: ${productosResult.rows[0].primer_registro}`)
    console.log(`📅 Último registro: ${productosResult.rows[0].ultimo_registro}`)
    console.log("📝 Últimos 5 productos:")
    sampleProductos.rows.forEach((p, i) => {
      console.log(
        `   ${i + 1}. ${p.codigo} - ${p.nombre} - $${Number.parseFloat(p.precio_base).toLocaleString("es-CO")} - IVA: ${p.tiene_iva ? "Sí" : "No"}`,
      )
    })

    // Probar búsquedas
    console.log("\n🔍 === PROBANDO BÚSQUEDAS ===")

    const searchTest = await client.query(`
      SELECT codigo, nombre 
      FROM proveedores 
      WHERE LOWER(codigo) LIKE '%1%' OR LOWER(nombre) LIKE '%a%'
      LIMIT 3
    `)

    console.log("🔎 Búsqueda de proveedores (contiene '1' o 'a'):")
    searchTest.rows.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.codigo} - ${p.nombre}`)
    })

    const productSearchTest = await client.query(`
      SELECT codigo, nombre, precio_base 
      FROM productos 
      WHERE LOWER(codigo) LIKE '%prod%' OR LOWER(nombre) LIKE '%a%'
      LIMIT 3
    `)

    console.log("🔎 Búsqueda de productos (contiene 'prod' o 'a'):")
    productSearchTest.rows.forEach((p, i) => {
      console.log(
        `   ${i + 1}. ${p.codigo} - ${p.nombre} - $${Number.parseFloat(p.precio_base).toLocaleString("es-CO")}`,
      )
    })

    await client.end()

    console.log("\n🎉 === VERIFICACIÓN COMPLETADA ===")
    console.log("✅ Los datos están listos para usar en el autocompletado")
    console.log("🚀 Puedes probar el formulario ahora")
  } catch (error) {
    console.error("💥 Error verificando datos:", error.message)
    process.exit(1)
  }
}

main()
