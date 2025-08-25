import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"

// Configuración
const CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_ROWS_TO_PROCESS: 10000,
  VALUE_KEYWORDS: ['valor', 'total', 'importe', 'monto', 'amount', 'value', 'saldo', 'neto'],
  DATE_KEYWORDS: ['fecha', 'date', 'emision', 'elaboracion'],
  DOCUMENT_KEYWORDS: ['comprobante', 'factura', 'documento', 'nro', 'numero']
}


/**
 * Función principal para manejar las peticiones POST
 */
export async function POST(request: NextRequest) {
  try {
    console.log("=== INICIO DE PROCESAMIENTO DE ARCHIVO ===")
    
    // Manejar preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { 
        status: 204, 
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        } 
      })
    }
    
    // Obtener el archivo de la petición
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }
    
    // Validar tamaño del archivo
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(2)}MB). ` +
                 `Tamaño máximo permitido: ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB` 
        },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // Leer el archivo Excel
    console.log(`Procesando archivo: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)
    
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    
    if (workbook.SheetNames.length === 0) {
      throw new Error('El archivo no contiene hojas de cálculo')
    }
    
    // Tomar la primera hoja
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    
    // Convertir a JSON
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' })
    
    if (jsonData.length < 2) {
      throw new Error('El archivo no contiene suficientes filas de datos')
    }
    
    // Buscar automáticamente las columnas de interés
    const headerRow = Array.isArray(jsonData[0]) ? jsonData[0].map(String) : []
    let valueColumn = -1
    
    // Buscar columna de valor por nombre de columna
    for (let i = 0; i < headerRow.length; i++) {
      const header = String(headerRow[i] || '').toLowerCase().trim()
      if (CONFIG.VALUE_KEYWORDS.some(keyword => header.includes(keyword))) {
        valueColumn = i
        console.log(`Columna de valor encontrada: ${header} (columna ${i + 1})`)
        break
      }
    }
    
    // Si no encontramos la columna por nombre, buscar en las primeras filas
    if (valueColumn === -1) {
      console.log('No se encontró columna de valor por nombre, buscando patrones numéricos...')
      
      // Buscar en las primeras 10 filas
      for (let rowIndex = 0; rowIndex < Math.min(10, jsonData.length); rowIndex++) {
        const row = jsonData[rowIndex] || []
        
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cellValue = String(row[colIndex] || '').trim()
          
          // Intentar extraer un valor numérico
          const numericValue = parseNumericValue(cellValue)
          if (numericValue !== null && numericValue > 0) {
            valueColumn = colIndex
            console.log(`Valor numérico encontrado en fila ${rowIndex + 1}, columna ${colIndex + 1}: ${cellValue}`)
            break
          }
        }
        
        if (valueColumn !== -1) break
      }
    }
    
    // Si aún no encontramos la columna de valor, usar la última columna
    if (valueColumn === -1) {
      console.log('No se pudo identificar la columna de valor, usando la última columna')
      valueColumn = Math.max(0, headerRow.length - 1)
    }
    
    // Procesar los datos
    let totalValue = 0
    let processedCount = 0
    let skippedCount = 0
    
    // Empezar desde la segunda fila (asumiendo que la primera es el encabezado)
    const startRow = 1
    const endRow = Math.min(jsonData.length, CONFIG.MAX_ROWS_TO_PROCESS + 1)
    
    for (let i = startRow; i < endRow; i++) {
      const row = jsonData[i] || []
      const valueStr = String(row[valueColumn] || '').trim()
      
      // Intentar extraer el valor numérico
      const numericValue = parseNumericValue(valueStr)
      
      if (numericValue !== null) {
        totalValue += numericValue
        processedCount++
      } else {
        skippedCount++
      }
    }
    
    // Calcular estadísticas
    const averageValue = processedCount > 0 ? totalValue / processedCount : 0
    
    // Mostrar resumen
    console.log(`Procesamiento completado:`)
    console.log(`- Filas procesadas: ${processedCount}`)
    console.log(`- Filas omitidas: ${skippedCount}`)
    console.log(`- Valor total: ${formatCurrency(totalValue)}`)
    console.log(`- Valor promedio: ${formatCurrency(averageValue)}`)
    
    // Devolver resultados
    return NextResponse.json({
      success: true,
      filename: file.name,
      fileSize: file.size,
      totalValue,
      processed: processedCount,
      skipped: skippedCount,
      averageValue: parseFloat(averageValue.toFixed(2)),
      debugInfo: {
        valueColumn,
        headers: headerRow,
        sampleRow: jsonData[1] || []
      }
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
    
  } catch (error) {
    // Manejar errores
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error al procesar el archivo:', errorMessage)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar el archivo',
        details: errorMessage,
      },
      { 
        status: 500, 
        headers: { 'Access-Control-Allow-Origin': '*' } 
      }
    )
  }
}

/**
 * Formatea un valor numérico como moneda
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

/**
 * Intenta extraer un valor numérico de una cadena
 * Maneja diferentes formatos: 1.234.567,89 | 1,234,567.89 | 1234567,89 | etc.
 */
function parseNumericValue(str: string): number | null {
  if (!str) return null
  
  // Limpiar el string
  const cleanStr = String(str)
    .replace(/[^\d.,-]/g, '') // Mantener solo números, puntos, comas y signos negativos
    .replace(/\s+/g, '')      // Eliminar espacios
    .replace(/\./g, '')       // Eliminar puntos de miles
    .replace(/,/g, '.')       // Convertir comas a puntos decimales
    .trim()

  // Verificar si es un número válido
  const num = parseFloat(cleanStr)
  return isNaN(num) ? null : num
}
