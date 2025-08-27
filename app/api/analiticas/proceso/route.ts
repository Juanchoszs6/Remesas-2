import { type NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { saveUploadedFile } from "@/lib/db"

/**
 * SISTEMA ROBUSTO DE PROCESAMIENTO DE DOCUMENTOS SIIGO
 *
 * Este sistema está diseñado para procesar múltiples archivos Excel de Siigo
 * de manera simultánea, con detección inteligente de estructura de datos,
 * parsing robusto de valores monetarios colombianos, y manejo exhaustivo de errores.
 *
 * Características principales:
 * - Procesamiento de múltiples archivos simultáneos
 * - Detección automática de estructura de datos
 * - Parsing robusto de moneda colombiana con múltiples estrategias
 * - Manejo de archivos grandes con optimización de memoria
 * - Detección automática de tipos de documento (FC, ND, DS, RP)
 * - Logging exhaustivo para debugging
 * - Recuperación de errores y fallbacks múltiples
 */

// ==================== INTERFACES Y TIPOS ====================

interface ProcessedData {
  values: number[]
  total: number
  month?: number
  year?: number
  totalValue?: number
  rowCount?: number
  averageValue?: number
}

interface DebugInfo {
  structure?: unknown;
  bestStructure?: unknown;
  debugSamples?: Array<Record<string, unknown>>;
  errorSamples?: Array<Record<string, unknown>>;
  sampleCount?: number;
  totalRows?: number;
  totalColumns?: number;
  totalRowsScanned?: number;
  allCandidates?: unknown[];
  jsonDataLength?: number;
  jsonDataSample?: unknown[];
  memoryUsedMB?: number;
  [key: string]: unknown; // Allow additional properties
}

interface FileProcessingResult {
  success: boolean;
  filename: string;
  fileSize: number;
  documentType?: DocumentType;
  month?: number;
  year?: number;
  totalValue?: number;
  processed?: number;
  skipped?: number;
  error?: string;
  details?: string;
  debugInfo?: DebugInfo;
  processingTime?: number;
  memoryUsage?: number;
}

interface DataStructureCandidate {
  headerRow: number
  dataStartRow: number
  dataEndRow: number
  valueColumn: number
  dateColumn: number
  comprobanteColumn: number
  proveedorColumn: number
  confidence: number
  columnCount: number
  dataRowCount: number
  averageRowLength: number
}

interface CurrencyParseResult {
  value: number
  confidence: number
  method: string
  originalValue: string
  cleanedValue: string
}

interface DateParseResult {
  date: Date | null
  confidence: number
  method: string
  originalValue: string
}

interface ExcelReadingStrategy {
  name: string
  options: XLSX.ParsingOptions
  priority: number
}

type DocumentType = "FC" | "ND" | "DS" | "RP"

// ==================== CONSTANTES Y CONFIGURACIÓN ====================

const DOCUMENT_TYPE_NAMES = {
  FC: "Factura de Compra",
  ND: "Nota Débito",
  DS: "Documento Soporte",
  RP: "Recibo de Pago",
} as const

const PROCESSING_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_FILES_SIMULTANEOUS: 20,
  MIN_CONFIDENCE_THRESHOLD: 0.3,
  MAX_ROWS_TO_SCAN: 1000,
  CHUNK_SIZE: 100, // Procesar en chunks para archivos grandes
  MEMORY_THRESHOLD: 100 * 1024 * 1024, // 100MB
} as const

const EXCEL_READING_STRATEGIES: ExcelReadingStrategy[] = [
  {
    name: "standard",
    options: {
      type: "array",
      cellDates: true,
      cellText: true,
      raw: false,
      cellFormula: false,
      cellNF: false,
      cellStyles: false,
      sheetStubs: false,
    },
    priority: 1,
  },
  {
    name: "raw_mode",
    options: {
      type: "array",
      raw: true,
      cellDates: false,
      cellText: false,
      sheetStubs: true,
    },
    priority: 2,
  },
  {
    name: "text_mode",
    options: {
      type: "array",
      cellText: true,
      raw: false,
      cellDates: false
    },
    priority: 3,
  },
  {
    name: "binary_fallback",
    options: {
      type: "binary",
      cellDates: true,
      cellText: true,
    },
    priority: 4,
  },
]

// ==================== UTILIDADES DE PARSING ====================

/**
 * Parser robusto para valores monetarios colombianos
 * Maneja múltiples formatos: 1.234.567,89 | 1,234,567.89 | 1234567,89 | etc.
 */
const parseColombianCurrencyRobust = (valueInput: string | number | boolean | null | undefined): CurrencyParseResult => {
  const originalValue = String(valueInput || "")

  if (!valueInput || valueInput === null || valueInput === undefined) {
    return {
      value: 0,
      confidence: 1.0,
      method: "null_or_undefined",
      originalValue,
      cleanedValue: "",
    }
  }

  // Manejar números directos
  if (typeof valueInput === "number") {
    const absValue = Math.abs(valueInput)
    return {
      value: absValue,
      confidence: 1.0,
      method: "direct_number",
      originalValue,
      cleanedValue: String(absValue),
    }
  }

  let cleanValue = String(valueInput).trim()

  if (!cleanValue || cleanValue === "0" || cleanValue === "-" || cleanValue === "N/A") {
    return {
      value: 0,
      confidence: 1.0,
      method: "explicit_zero",
      originalValue,
      cleanedValue: cleanValue,
    }
  }

  // Remover símbolos de moneda y espacios extra
  const currencySymbols = /[$€£¥₹₽COP\s]/gi
  cleanValue = cleanValue.replace(currencySymbols, "").trim()

  // Estrategia 1: Formato colombiano con decimales (1.234.567,89)
  const colombianDecimalRegex = /^(\d{1,3}(?:\.\d{3})*),(\d{1,2})$/
  const colombianDecimalMatch = cleanValue.match(colombianDecimalRegex)
  if (colombianDecimalMatch) {
    const integerPart = colombianDecimalMatch[1].replace(/\./g, "")
    const decimalPart = colombianDecimalMatch[2].padEnd(2, "0")
    const result = Number.parseFloat(`${integerPart}.${decimalPart}`)
    if (!isNaN(result) && result >= 0) {
      return {
        value: result,
        confidence: 0.95,
        method: "colombian_decimal_format",
        originalValue,
        cleanedValue: `${integerPart}.${decimalPart}`,
      }
    }
  }

  // Estrategia 2: Formato colombiano sin decimales (1.234.567)
  const colombianIntegerRegex = /^(\d{1,3}(?:\.\d{3})+)$/
  const colombianIntegerMatch = cleanValue.match(colombianIntegerRegex)
  if (colombianIntegerMatch) {
    const integerPart = colombianIntegerMatch[1].replace(/\./g, "")
    const result = Number.parseFloat(integerPart)
    if (!isNaN(result) && result >= 0) {
      return {
        value: result,
        confidence: 0.9,
        method: "colombian_integer_format",
        originalValue,
        cleanedValue: integerPart,
      }
    }
  }

  // Estrategia 3: Formato americano (1,234,567.89)
  const americanFormatRegex = /^(\d{1,3}(?:,\d{3})*)\.(\d{1,2})$/
  const americanFormatMatch = cleanValue.match(americanFormatRegex)
  if (americanFormatMatch) {
    const integerPart = americanFormatMatch[1].replace(/,/g, "")
    const decimalPart = americanFormatMatch[2].padEnd(2, "0")
    const result = Number.parseFloat(`${integerPart}.${decimalPart}`)
    if (!isNaN(result) && result >= 0) {
      return {
        value: result,
        confidence: 0.85,
        method: "american_format",
        originalValue,
        cleanedValue: `${integerPart}.${decimalPart}`,
      }
    }
  }

  // Estrategia 4: Formato americano sin decimales (1,234,567)
  const americanIntegerRegex = /^(\d{1,3}(?:,\d{3})+)$/
  const americanIntegerMatch = cleanValue.match(americanIntegerRegex)
  if (americanIntegerMatch) {
    const integerPart = americanIntegerMatch[1].replace(/,/g, "")
    const result = Number.parseFloat(integerPart)
    if (!isNaN(result) && result >= 0) {
      return {
        value: result,
        confidence: 0.8,
        method: "american_integer_format",
        originalValue,
        cleanedValue: integerPart,
      }
    }
  }

  // Estrategia 5: Decimal simple con coma (1234567,89)
  const simpleCommaRegex = /^(\d+),(\d{1,2})$/
  const simpleCommaMatch = cleanValue.match(simpleCommaRegex)
  if (simpleCommaMatch) {
    const integerPart = simpleCommaMatch[1]
    const decimalPart = simpleCommaMatch[2].padEnd(2, "0")
    const result = Number.parseFloat(`${integerPart}.${decimalPart}`)
    if (!isNaN(result) && result >= 0) {
      return {
        value: result,
        confidence: 0.75,
        method: "simple_comma_decimal",
        originalValue,
        cleanedValue: `${integerPart}.${decimalPart}`,
      }
    }
  }

  // Estrategia 6: Decimal simple con punto (1234567.89)
  const simpleDotRegex = /^(\d+)\.(\d{1,2})$/
  const simpleDotMatch = cleanValue.match(simpleDotRegex)
  if (simpleDotMatch) {
    const result = Number.parseFloat(cleanValue)
    if (!isNaN(result) && result >= 0) {
      return {
        value: result,
        confidence: 0.7,
        method: "simple_dot_decimal",
        originalValue,
        cleanedValue: cleanValue,
      }
    }
  }

  // Estrategia 7: Solo números enteros (1234567)
  const integerOnlyRegex = /^(\d+)$/
  const integerOnlyMatch = cleanValue.match(integerOnlyRegex)
  if (integerOnlyMatch) {
    const result = Number.parseFloat(cleanValue)
    if (!isNaN(result) && result >= 0) {
      return {
        value: result,
        confidence: 0.65,
        method: "integer_only",
        originalValue,
        cleanedValue: cleanValue,
      }
    }
  }

  // Estrategia 8: Extraer solo números (último recurso)
  const numbersOnly = cleanValue.replace(/[^\d]/g, "")
  if (numbersOnly && numbersOnly.length > 0) {
    const result = Number.parseFloat(numbersOnly)
    if (!isNaN(result) && result > 0) {
      return {
        value: result,
        confidence: 0.4,
        method: "numbers_extraction",
        originalValue,
        cleanedValue: numbersOnly,
      }
    }
  }

  // Estrategia 9: Parsing directo como último recurso
  const directParseValue = cleanValue.replace(/[^\d.-]/g, "")
  const directResult = Number.parseFloat(directParseValue)
  if (!isNaN(directResult) && directResult > 0) {
    return {
      value: Math.abs(directResult),
      confidence: 0.2,
      method: "direct_parse_fallback",
      originalValue,
      cleanedValue: directParseValue,
    }
  }

  return {
    value: 0,
    confidence: 0,
    method: "parsing_failed",
    originalValue,
    cleanedValue: cleanValue,
  }
}

/**
 * Parser robusto para fechas de Siigo
 * Maneja formatos: DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, números de Excel, etc.
 */
const parseSiigoDateRobust = (dateValue: string | number | boolean | Date | null | undefined): DateParseResult => {
  const originalValue = String(dateValue || "")

  if (!dateValue || dateValue === null || dateValue === undefined) {
    return {
      date: null,
      confidence: 0,
      method: "null_or_undefined",
      originalValue,
    }
  }

  try {
    // Estrategia 1: Ya es un objeto Date
    if (dateValue instanceof Date) {
      if (!isNaN(dateValue.getTime())) {
        return {
          date: new Date(dateValue),
          confidence: 1.0,
          method: "date_object",
          originalValue,
        }
      }
    }

    // Estrategia 2: Número serial de Excel
    if (typeof dateValue === "number") {
      // Rango válido para fechas de Excel (1900-2100)
      if (dateValue > 1 && dateValue < 73050) {
        const excelEpoch = new Date(1900, 0, 1)
        const jsDate = new Date(excelEpoch.getTime() + (dateValue - 2) * 86400 * 1000)

        if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() >= 2020 && jsDate.getFullYear() <= 2030) {
          return {
            date: jsDate,
            confidence: 0.9,
            method: "excel_serial_number",
            originalValue,
          }
        }
      }
    }

    // Estrategia 3: String parsing
    if (typeof dateValue === "string") {
      const cleanDateStr = dateValue.trim()

      // Formato DD/MM/YYYY o DD/MM/YY
      const ddmmyyyyRegex = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/
      const ddmmyyyyMatch = cleanDateStr.match(ddmmyyyyRegex)
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch
        let yearNum = Number.parseInt(year, 10)

        // Ajustar años de 2 dígitos
        if (yearNum < 100) {
          yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum
        }

        const date = new Date(yearNum, Number.parseInt(month, 10) - 1, Number.parseInt(day, 10))
        if (!isNaN(date.getTime()) && yearNum >= 2020 && yearNum <= 2030) {
          return {
            date,
            confidence: 0.85,
            method: "dd_mm_yyyy_format",
            originalValue,
          }
        }
      }

      // Formato YYYY-MM-DD
      const yyyymmddRegex = /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/
      const yyyymmddMatch = cleanDateStr.match(yyyymmddRegex)
      if (yyyymmddMatch) {
        const [, year, month, day] = yyyymmddMatch
        const date = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10))
        if (!isNaN(date.getTime())) {
          return {
            date,
            confidence: 0.8,
            method: "yyyy_mm_dd_format",
            originalValue,
          }
        }
      }

      // Formato MM/DD/YYYY (americano)
      const mmddyyyyRegex = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/
      const mmddyyyyMatch = cleanDateStr.match(mmddyyyyRegex)
      if (mmddyyyyMatch) {
        const [, month, day, year] = mmddyyyyMatch
        const date = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10))
        if (!isNaN(date.getTime()) && Number.parseInt(year, 10) >= 2020 && Number.parseInt(year, 10) <= 2030) {
          return {
            date,
            confidence: 0.75,
            method: "mm_dd_yyyy_format",
            originalValue,
          }
        }
      }

      // Intentar parsing directo con Date constructor
      const directDate = new Date(cleanDateStr)
      if (!isNaN(directDate.getTime()) && directDate.getFullYear() >= 2020 && directDate.getFullYear() <= 2030) {
        return {
          date: directDate,
          confidence: 0.6,
          method: "direct_date_constructor",
          originalValue,
        }
      }
    }
  } catch (error) {
    console.error("[v0] Error parsing date:", error)
  }

  return {
    date: null,
    confidence: 0,
    method: "parsing_failed",
    originalValue,
  }
}

// ==================== DETECCIÓN DE ESTRUCTURA DE DATOS ====================

/**
 * Detecta inteligentemente la estructura de datos en el archivo Excel
 * Busca encabezados y filas de datos de manera flexible
 */
const detectDataStructureIntelligent = (jsonData: (string | number | boolean | null)[][]): DataStructureCandidate[] => {
  console.log("[v0] Iniciando detección inteligente de estructura de datos...")

  const candidates: DataStructureCandidate[] = []
  const maxRowsToScan = Math.min(PROCESSING_CONFIG.MAX_ROWS_TO_SCAN, jsonData.length)

  const valueKeywords = [
    "valor",
    "total",
    "importe",
    "monto",
    "precio",
    "amount",
    "value",
    "subtotal",
    "neto",
    "bruto",
    "base",
  ]
  const dateKeywords = ["fecha", "elaboracion", "emision", "date", "created", "timestamp", "vencimiento", "expedicion"]
  const comprobanteKeywords = [
    "comprobante",
    "factura",
    "documento",
    "numero",
    "nro",
    "invoice",
    "document",
    "consecutivo",
    "folio",
  ]
  const proveedorKeywords = [
    "proveedor",
    "cliente",
    "nombre",
    "empresa",
    "supplier",
    "vendor",
    "tercero",
    "nit",
    "razon",
  ]

  for (let headerRowIndex = 0; headerRowIndex < Math.min(30, maxRowsToScan); headerRowIndex++) {
    const headerRow = jsonData[headerRowIndex] || []

    if (headerRow.length < 2) continue

    const headerTexts = headerRow.map((cell) =>
      String(cell || "")
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    )

    let headerScore = 0
    let valueColumn = -1
    let dateColumn = -1
    let comprobanteColumn = -1
    let proveedorColumn = -1

    // Evaluar cada columna como posible encabezado
    headerTexts.forEach((text, colIndex) => {
      // Buscar columna de valor
      if (valueKeywords.some((keyword) => text.includes(keyword))) {
        headerScore += 4
        if (valueColumn === -1) valueColumn = colIndex
      }

      // Buscar columna de fecha
      if (dateKeywords.some((keyword) => text.includes(keyword))) {
        headerScore += 3
        if (dateColumn === -1) dateColumn = colIndex
      }

      // Buscar columna de comprobante
      if (comprobanteKeywords.some((keyword) => text.includes(keyword))) {
        headerScore += 3
        if (comprobanteColumn === -1) comprobanteColumn = colIndex
      }

      // Buscar columna de proveedor
      if (proveedorKeywords.some((keyword) => text.includes(keyword))) {
        headerScore += 2
        if (proveedorColumn === -1) proveedorColumn = colIndex
      }

      if (text.length > 2 && text.length < 50 && text.match(/[a-z]/)) {
        headerScore += 1
      }

      if (text.includes("siigo") || text.includes("contabilidad") || text.includes("registro")) {
        headerScore += 2
      }
    })

    if (headerScore >= 3) {
      console.log(`[v0] Candidato de encabezado encontrado en fila ${headerRowIndex + 1} (score: ${headerScore})`)

      let dataStartRow = -1
      let dataEndRow = -1
      let validDataRows = 0
      let totalRowsScanned = 0
      let averageRowLength = 0
      let rowLengthSum = 0

      for (let dataRowIndex = headerRowIndex + 1; dataRowIndex < maxRowsToScan; dataRowIndex++) {
        const dataRow = jsonData[dataRowIndex] || []
        totalRowsScanned++
        rowLengthSum += dataRow.length

        let hasValidData = false

        // Estrategia 1: Verificar columna de valor si existe
        if (valueColumn >= 0 && valueColumn < dataRow.length && dataRow[valueColumn]) {
          const valueParseResult = parseColombianCurrencyRobust(dataRow[valueColumn])
          if (valueParseResult && valueParseResult.value > 0 && valueParseResult.confidence > 0.2) {
            hasValidData = true
          }
        }

        // Estrategia 2: Verificar si hay al menos 2 celdas con contenido significativo
        if (!hasValidData) {
          const nonEmptyCells = dataRow.filter(
            (cell) => cell && String(cell).trim() !== "" && String(cell).trim().length > 1,
          ).length

          if (nonEmptyCells >= 2) {
            // Verificar si alguna celda parece un valor monetario
            const hasMonetaryValue = dataRow.some((cell) => {
              const parsed = parseColombianCurrencyRobust(cell)
              return parsed && parsed.value > 0
            })

            if (hasMonetaryValue) {
              hasValidData = true
            }
          }
        }

        // Estrategia 3: Verificar patrones de fecha o números
        if (!hasValidData) {
          const hasDateOrNumber = dataRow.some((cell) => {
            const cellStr = String(cell || "").trim()
            return (
              cellStr.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || // Fecha
              cellStr.match(/^\d+$/) || // Número entero
              cellStr.match(/^\d+[.,]\d+$/)
            ) // Número decimal
          })

          if (hasDateOrNumber && dataRow.filter((cell) => cell && String(cell).trim() !== "").length >= 2) {
            hasValidData = true
          }
        }

        if (hasValidData) {
          if (dataStartRow === -1) {
            dataStartRow = dataRowIndex
          }
          dataEndRow = dataRowIndex + 1
          validDataRows++
        } else if (validDataRows > 0) {
          const emptyRowsAfterData = dataRowIndex - (dataEndRow - 1)
          if (emptyRowsAfterData > 5 && dataRow.every((cell) => !cell || String(cell).trim() === "")) {
            break
          }
        }
      }

      averageRowLength = totalRowsScanned > 0 ? rowLengthSum / totalRowsScanned : 0

      const dataRatio = totalRowsScanned > 0 ? validDataRows / totalRowsScanned : 0
      const columnUtilization = Math.min(1, headerRow.length / 5) // Normalizar por número de columnas
      const dataVolumeScore = Math.min(1, validDataRows / 50) // Bonus por volumen de datos

      const confidence = Math.min(
        1.0,
        (headerScore / 20) * 0.3 + dataRatio * 0.3 + dataVolumeScore * 0.2 + columnUtilization * 0.2,
      )

      if (validDataRows > 0) {
        candidates.push({
          headerRow: headerRowIndex,
          dataStartRow,
          dataEndRow,
          valueColumn,
          dateColumn,
          comprobanteColumn,
          proveedorColumn,
          confidence,
          columnCount: headerRow.length,
          dataRowCount: validDataRows,
          averageRowLength,
        })

        console.log(
          `[v0] Candidato agregado: filas ${dataStartRow + 1}-${dataEndRow}, ${validDataRows} filas válidas, confianza: ${confidence.toFixed(3)}`,
        )
      }
    }
  }

  // Ordenar candidatos por confianza
  candidates.sort((a, b) => b.confidence - a.confidence)

  console.log(`[v0] Se encontraron ${candidates.length} candidatos de estructura`)
  return candidates
}

// ==================== DETECCIÓN DE TIPO DE DOCUMENTO ====================

/**
 * Detecta el tipo de documento basado en el nombre del archivo y contenido
 */
const detectDocumentTypeAdvanced = (filename: string, sampleData?: (string | number | boolean | null)[][]): DocumentType => {
  const upperFilename = filename.toUpperCase()

  // Primero verificar si hay contenido de muestra para analizar
  if (sampleData && sampleData.length > 0) {
    // Verificar la celda A8 (fila 7, columna 0) que contiene el tipo de documento
    if (sampleData.length > 7 && sampleData[7] && sampleData[7][0]) {
      const cellA8 = String(sampleData[7][0]).toUpperCase().trim();
      console.log(`[v0] 🔍 Analizando celda A8: ${cellA8}`);
      
      // Mapeo de valores de la celda A8 a tipos de documento
      if (cellA8.includes('COMPRA/GASTO') || cellA8.includes('COMPRA') || cellA8.includes('GASTO')) {
        console.log('[v0] 📄 Tipo de documento detectado por celda A8: FC (Compras/Gastos)');
        return 'FC';
      } else if (cellA8.includes('NOTA DÉBITO') || cellA8.includes('NOTA DEBITO') || cellA8.includes('NOTA DÉBITO') || cellA8.includes('NOTA_DEBITO')) {
        console.log('[v0] 📄 Tipo de documento detectado por celda A8: ND (Nota Débito)');
        return 'ND';
      } else if (cellA8.includes('DOCUMENTO SOPORTE') || cellA8.includes('DOCUMENTO_SOPORTE') || cellA8.includes('DOCUMENTOS SOPORTE')) {
        console.log('[v0] 📄 Tipo de documento detectado por celda A8: DS (Documento Soporte)');
        return 'DS';
      } else if (cellA8.includes('RECIBO DE PAGO') || cellA8.includes('PAGOS')) {
        console.log('[v0] 📄 Tipo de documento detectado por celda A8: RP (Recibo de Pago)');
        return 'RP';
      }
    }
    
    // Si no se pudo determinar por la celda A8, intentar con búsqueda general
    const contentString = sampleData.flat().join(' ').toUpperCase();
    if (contentString.includes('COMPRAS') || contentString.includes('GASTOS')) {
      console.log('[v0] 📄 Tipo de documento detectado por contenido general: FC (Compras/Gastos)');
      return 'FC';
    }
  }

  // Detección por nombre de archivo (más confiable)
  if (upperFilename.includes("FC-") || (upperFilename.includes("FACTURA") && upperFilename.includes("COMPRA"))) {
    return "FC"
  }

  if (
    upperFilename.includes("ND-") ||
    (upperFilename.includes("NOTA") && (upperFilename.includes("DEBITO") || upperFilename.includes("DÉBITO")))
  ) {
    return "ND"
  }

  if (upperFilename.includes("DS-") || (upperFilename.includes("DOCUMENTO") && upperFilename.includes("SOPORTE"))) {
    return "DS"
  }

  if (upperFilename.includes("RP-") || (upperFilename.includes("RECIBO") && upperFilename.includes("PAGO"))) {
    return "RP"
  }

  // Detección por contenido si hay datos de muestra
  if (sampleData && sampleData.length > 0) {
    const docTypeCounts: Record<DocumentType, number> = { FC: 0, ND: 0, DS: 0, RP: 0 }

    for (const row of sampleData.slice(0, 20)) {
      for (const cell of row) {
        const cellStr = String(cell || "").toUpperCase()
        if (cellStr.match(/FC[-\s]\d+/)) docTypeCounts.FC++
        if (cellStr.match(/ND[-\s]\d+/)) docTypeCounts.ND++
        if (cellStr.match(/DS[-\s]\d+/)) docTypeCounts.DS++
        if (cellStr.match(/RP[-\s]\d+/)) docTypeCounts.RP++
      }
    }

    const maxCount = Math.max(...Object.values(docTypeCounts))
    if (maxCount > 0) {
      const detectedType = Object.entries(docTypeCounts).find(([, count]) => count === maxCount)?.[0] as DocumentType
      if (detectedType) return detectedType
    }
  }

  // Detección por patrones en nombre de archivo
  if (upperFilename.includes("COMPRAS") || upperFilename.includes("GASTOS")) return "FC"
  if (upperFilename.includes("INGRESOS") || upperFilename.includes("VENTAS")) return "FC"

  return "FC" // Por defecto
}

// ==================== UTILIDADES ====================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const getMemoryUsage = (): number => {
  if (typeof process !== "undefined" && process.memoryUsage) {
    return process.memoryUsage().heapUsed
  }
  return 0
}

const validateFileSize = (file: File): { valid: boolean; error?: string } => {
  if (file.size > PROCESSING_CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${PROCESSING_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB)`,
    }
  }
  return { valid: true }
}

// ==================== CONFIGURACIÓN DE CORS ====================

export const dynamic = "force-dynamic"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// ==================== ENDPOINTS ====================

export async function GET() {
  const systemInfo = {
    success: true,
    message: "Sistema de Procesamiento Siigo - Versión Robusta",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    capabilities: {
      multipleFiles: true,
      maxFiles: PROCESSING_CONFIG.MAX_FILES_SIMULTANEOUS,
      maxFileSize: `${PROCESSING_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`,
      supportedFormats: ["xlsx", "xls"],
      documentTypes: Object.keys(DOCUMENT_TYPE_NAMES),
      features: [
        "Detección inteligente de estructura de datos",
        "Parsing robusto de moneda colombiana con 9 estrategias",
        "Manejo de archivos grandes con optimización de memoria",
        "Procesamiento simultáneo de múltiples archivos",
        "Detección automática de tipos de documento",
        "Logging exhaustivo para debugging",
        "Recuperación de errores con múltiples fallbacks",
        "Validación de datos con scoring de confianza",
      ],
    },
    configuration: PROCESSING_CONFIG,
  }

  return new Response(JSON.stringify(systemInfo, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log("=== INICIO PROCESAMIENTO SIIGO ROBUSTO V2.0 ===")
  console.log(`[v0] Timestamp: ${new Date().toISOString()}`)

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // Inicializar estructuras de datos agregados
  const aggregatedData: Record<DocumentType, ProcessedData> = {
    FC: { values: Array(12).fill(0), total: 0, rowCount: 0 },
    ND: { values: Array(12).fill(0), total: 0, rowCount: 0 },
    DS: { values: Array(12).fill(0), total: 0, rowCount: 0 },
    RP: { values: Array(12).fill(0), total: 0, rowCount: 0 },
  }

  let totalProcessedRows = 0
  let totalSkippedRows = 0
  let grandTotalValue = 0
  const fileResults: FileProcessingResult[] = []
  let memoryPeakUsage = getMemoryUsage()

  try {
    // Obtener FormData
    const formData = await request.formData()
    const files: File[] = []

    // Recopilar archivos de múltiples fuentes
    const singleFile = formData.get("file") as File | null
    if (singleFile && singleFile instanceof File) {
      files.push(singleFile)
    }

    const multipleFiles = formData.getAll("files") as File[]
    files.push(...multipleFiles.filter((f) => f instanceof File))

    // También buscar archivos con nombres dinámicos
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file") && value instanceof File && !files.includes(value)) {
        files.push(value)
      }
    }

    console.log(`[v0] Archivos recibidos: ${files.length}`)

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No se proporcionaron archivos",
          details: "Por favor seleccione al menos un archivo Excel para procesar",
          timestamp: new Date().toISOString(),
        },
        { status: 400, headers: corsHeaders },
      )
    }

    if (files.length > PROCESSING_CONFIG.MAX_FILES_SIMULTANEOUS) {
      return NextResponse.json(
        {
          success: false,
          error: "Demasiados archivos",
          details: `Máximo ${PROCESSING_CONFIG.MAX_FILES_SIMULTANEOUS} archivos permitidos, recibidos: ${files.length}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400, headers: corsHeaders },
      )
    }

    // Validar tamaños de archivos
    for (const file of files) {
      const validation = validateFileSize(file)
      if (!validation.valid) {
        fileResults.push({
          success: false,
          filename: file.name,
          fileSize: file.size,
          error: "Archivo demasiado grande",
          details: validation.error,
        })
        continue
      }
    }

    // Procesar cada archivo
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex]
      const fileStartTime = Date.now()

      console.log(`\n=== PROCESANDO ARCHIVO ${fileIndex + 1}/${files.length}: ${file.name} ===`)
      console.log(`[v0] Tamaño: ${(file.size / 1024).toFixed(2)}KB`)

      try {
        const fileResult = await processIndividualFileAdvanced(file, fileIndex + 1)
        fileResult.processingTime = Date.now() - fileStartTime
        fileResult.memoryUsage = getMemoryUsage()

        fileResults.push(fileResult)

        // Actualizar pico de memoria
        memoryPeakUsage = Math.max(memoryPeakUsage, fileResult.memoryUsage || 0)

        if (fileResult.success && fileResult.documentType) {
          const docType = fileResult.documentType

          // Agregar a datos consolidados
          if (fileResult.month !== undefined && fileResult.month >= 0 && fileResult.month < 12) {
            aggregatedData[docType].values[fileResult.month] += fileResult.totalValue || 0
          }

          aggregatedData[docType].total += fileResult.totalValue || 0
          aggregatedData[docType].rowCount = (aggregatedData[docType].rowCount || 0) + (fileResult.processed || 0)

          totalProcessedRows += fileResult.processed || 0
          totalSkippedRows += fileResult.skipped || 0
          grandTotalValue += fileResult.totalValue || 0

          console.log(
            `[v0] ✅ ${file.name}: ${formatCurrency(fileResult.totalValue || 0)} (${fileResult.processed} filas)`,
          )

          // Guardar en la base de datos
          try {
            if (fileResult.documentType && fileResult.totalValue !== undefined) {
              const monthToSave = fileResult.month || (new Date().getMonth() + 1)
              const yearToSave = fileResult.year || new Date().getFullYear()
              
              console.log(`[v0] 💾 Guardando en BD: Tipo=${fileResult.documentType}, ` +
                         `Mes=${monthToSave}, Año=${yearToSave}, ` +
                         `Valor=${fileResult.totalValue}, Filas=${fileResult.processed || 0}`)
              
              await saveUploadedFile(
                1, // TODO: Reemplazar con el ID de usuario real
                file.name,
                fileResult.documentType,
                monthToSave,
                yearToSave,
                fileResult.totalValue,
                fileResult.processed || 0
              )
              console.log(`[v0] 📊 Datos guardados en la base de datos para ${file.name}`)
            }
          } catch (dbError) {
            console.error('[v0] ❌ Error al guardar en la base de datos:', dbError)
          }
        } else {
          console.log(`[v0] ❌ ${file.name}: ${fileResult.error}`)
        }

        // Verificar uso de memoria
        if (fileResult.memoryUsage && fileResult.memoryUsage > PROCESSING_CONFIG.MEMORY_THRESHOLD) {
          console.log(`[v0] ⚠️ Alto uso de memoria: ${(fileResult.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
        }
      } catch (error) {
        console.error(`[v0] Error crítico procesando ${file.name}:`, error)
        fileResults.push({
          success: false,
          filename: file.name,
          fileSize: file.size,
          error: "Error crítico de procesamiento",
          details: error instanceof Error ? error.message : "Error desconocido",
          processingTime: Date.now() - fileStartTime,
        })
      }
    }

    // Calcular estadísticas finales
    const successfulFiles = fileResults.filter((f) => f.success)
    const failedFiles = fileResults.filter((f) => !f.success)
    const totalProcessingTime = Date.now() - startTime

    // Calcular promedios para datos agregados
    Object.values(aggregatedData).forEach((data) => {
      if (data.rowCount && data.rowCount > 0) {
        data.averageValue = data.total / data.rowCount
      }
    })

    console.log(`\n=== RESUMEN FINAL ===`)
    console.log(`✅ Archivos exitosos: ${successfulFiles.length}/${files.length}`)
    console.log(`❌ Archivos fallidos: ${failedFiles.length}/${files.length}`)
    console.log(`📊 Total filas procesadas: ${totalProcessedRows.toLocaleString()}`)
    console.log(`⏭️ Total filas omitidas: ${totalSkippedRows.toLocaleString()}`)
    console.log(`💰 Valor total: ${formatCurrency(grandTotalValue)}`)
    console.log(`⏱️ Tiempo total: ${totalProcessingTime}ms`)
    console.log(`🧠 Memoria pico: ${(memoryPeakUsage / 1024 / 1024).toFixed(2)}MB`)
    console.log("====================")

    // Preparar respuesta
    const response = {
      success: true,
      message: `Procesamiento completado: ${successfulFiles.length}/${files.length} archivos exitosos`,
      summary: {
        filesProcessed: successfulFiles.length,
        totalFiles: files.length,
        filesFailed: failedFiles.length,
        totalRowsProcessed: totalProcessedRows,
        totalRowsSkipped: totalSkippedRows,
        grandTotalValue: Number.parseFloat(grandTotalValue.toFixed(2)),
        processingTimeMs: totalProcessingTime,
        memoryPeakUsageMB: Number.parseFloat((memoryPeakUsage / 1024 / 1024).toFixed(2)),
      },
      data: aggregatedData,
      fileResults: fileResults.map((result) => ({
        ...result,
        // Limitar debugInfo para reducir tamaño de respuesta
        debugInfo: result.debugInfo
          ? {
              structure: result.debugInfo.structure,
              sampleCount: result.debugInfo.debugSamples?.length || 0,
            }
          : undefined,
      })),
      timestamp: new Date().toISOString(),
    }

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : "Error desconocido"
    console.error("[v0] Error global del sistema:", error)

    return new Response(
      JSON.stringify(
        {
          success: false,
          error: "Error crítico del sistema",
          details: errorDetails,
          fileResults,
          processingTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }
}

// ==================== PROCESAMIENTO INDIVIDUAL DE ARCHIVOS ====================

/**
 * Procesa un archivo individual de manera robusta
 */
async function processIndividualFileAdvanced(file: File, _fileNumber: number): Promise<FileProcessingResult> {
  console.log(`[v0] 📁 Iniciando procesamiento: ${file.name}`)

  const startMemory = getMemoryUsage()
  let workbook: XLSX.WorkBook | null = null
  const jsonData: (string | number | boolean | null)[][] = []

  try {
    // Leer archivo con múltiples estrategias
    const arrayBuffer = await file.arrayBuffer()
    console.log(`[v0] 📖 Archivo leído en memoria: ${(arrayBuffer.byteLength / 1024).toFixed(2)}KB`)

    let readingError: Error | null = null

    // Intentar múltiples estrategias de lectura
    for (const strategy of EXCEL_READING_STRATEGIES) {
      try {
        console.log(`[v0] 🔄 Intentando estrategia: ${strategy.name}`)
        workbook = XLSX.read(arrayBuffer, strategy.options)
        console.log(`[v0] ✅ Lectura exitosa con estrategia: ${strategy.name}`)
        break
      } catch (error) {
        console.log(`[v0] ❌ Falló estrategia ${strategy.name}:`, error instanceof Error ? error.message : error)
        readingError = error instanceof Error ? error : new Error(String(error))
        continue
      }
    }

    if (!workbook) {
      throw new Error(`No se pudo leer el archivo con ninguna estrategia. Último error: ${readingError?.message}`)
    }

    // Obtener la primera hoja
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error("El archivo no contiene hojas de cálculo")
    }

    const worksheet = workbook.Sheets[firstSheetName]
    if (!worksheet) {
      throw new Error(`No se pudo acceder a la hoja: ${firstSheetName}`)
    }

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")
    console.log(`[v0] 📋 Hoja: ${firstSheetName}, Rango inicial: ${XLSX.utils.encode_range(range)}`)

    // Intentar múltiples métodos de extracción de datos
    const extractionMethods = [
      // Método 1: Usar XLSX.utils.sheet_to_json con header como array
      () => {
        console.log(`[v0] 🔄 Método 1: sheet_to_json con header array`)
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
          raw: false,
          dateNF: "yyyy-mm-dd",
        }) as (string | number | boolean | null)[][]

        if (rawData.length > 0 && rawData[0].length > 1) {
          jsonData.push(...rawData)
          console.log(`[v0] ✅ Método 1 exitoso: ${rawData.length} filas, ${rawData[0].length} columnas`)
          return true
        }
        return false
      },

      // Método 2: Lectura manual celda por celda con rango expandido
      () => {
        console.log(`[v0] 🔄 Método 2: Lectura manual con rango expandido`)

        // Expandir el rango para asegurar que capturamos todas las columnas
        const expandedRange = {
          s: { r: 0, c: 0 },
          e: { r: Math.max(range.e.r, 500), c: Math.max(range.e.c, 20) },
        }

        let maxCol = 0
        let maxRow = 0

        // Primero, encontrar el rango real de datos
        for (let R = 0; R <= expandedRange.e.r; R++) {
          let hasDataInRow = false
          for (let C = 0; C <= expandedRange.e.c; C++) {
            const cellAddress = { r: R, c: C }
            const cellRef = XLSX.utils.encode_cell(cellAddress)
            const cell = worksheet[cellRef]

            if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== "") {
              hasDataInRow = true
              maxCol = Math.max(maxCol, C)
              maxRow = Math.max(maxRow, R)
            }
          }

          // Si no hay datos en 10 filas consecutivas después de encontrar datos, parar
          if (!hasDataInRow && maxRow > 0 && R > maxRow + 10) {
            break
          }
        }

        console.log(`[v0] 📊 Rango real detectado: ${maxRow + 1} filas, ${maxCol + 1} columnas`)

        if (maxCol > 0) {
          // Extraer datos con el rango real
          for (let R = 0; R <= maxRow; R++) {
            const row: (string | number | boolean | null)[] = []
            for (let C = 0; C <= maxCol; C++) {
              const cellAddress = { r: R, c: C }
              const cellRef = XLSX.utils.encode_cell(cellAddress)
              const cell = worksheet[cellRef]

              let cellValue = ""
              if (cell) {
                if (cell.w) {
                  cellValue = cell.w
                } else if (cell.v !== undefined && cell.v !== null) {
                  cellValue = String(cell.v)
                } else if (cell.t) {
                  cellValue = cell.t
                }
              }

              row.push(cellValue)
            }
            jsonData.push(row)
          }

          console.log(`[v0] ✅ Método 2 exitoso: ${jsonData.length} filas, ${jsonData[0]?.length || 0} columnas`)
          return true
        }
        return false
      },

      // Método 3: Usar sheet_to_json sin header y luego convertir
      () => {
        console.log(`[v0] 🔄 Método 3: sheet_to_json sin header`)
        try {
          const rawData = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
            raw: false,
          }) as Array<Record<string, string | number | boolean | null>>

          if (rawData.length > 0) {
            // Convertir objetos a arrays
            const keys = Object.keys(rawData[0])
            if (keys.length > 1) {
              // Agregar fila de encabezados
              jsonData.push(keys)

              // Agregar datos
              rawData.forEach((row) => {
                const rowArray = keys.map((key) => row[key] || "")
                jsonData.push(rowArray)
              })

              console.log(`[v0] ✅ Método 3 exitoso: ${jsonData.length} filas, ${keys.length} columnas`)
              return true
            }
          }
        } catch (error) {
          console.log(`[v0] ❌ Método 3 falló:`, error)
        }
        return false
      },
    ]

    // Intentar cada método hasta que uno funcione
    let dataExtractionSuccess = false
    let extractionAttempts = 0

    for (const method of extractionMethods) {
      extractionAttempts++
      try {
        if (method()) {
          dataExtractionSuccess = true
          break
        }
      } catch (error) {
        console.log(`[v0] ❌ Método ${extractionAttempts} falló:`, error instanceof Error ? error.message : error)
      }

      // Limpiar jsonData para el siguiente intento
      jsonData.length = 0
    }

    if (!dataExtractionSuccess || jsonData.length === 0) {
      throw new Error("No se pudo extraer datos del archivo con ningún método")
    }

    console.log(`[v0] 📊 Dimensiones: ${jsonData.length} filas x ${jsonData[0]?.length || 0} columnas`)
    console.log(`[v0] 🔢 Total de celdas a procesar: ${jsonData.length * (jsonData[0]?.length || 0)}`)

    const structureCandidates = detectDataStructureIntelligent(jsonData)

    if (structureCandidates.length === 0) {
      const sampleData = jsonData.slice(0, 10).map((row, idx) => ({
        rowIndex: idx + 1,
        columnCount: row.length,
        data: row.slice(0, 15), // Primeras 15 columnas para debug
        hasNumericData: row.some((cell) => {
          const parsed = parseColombianCurrencyRobust(cell)
          return parsed && parsed.value > 0
        }),
      }))

      return {
        success: false,
        filename: file.name,
        fileSize: file.size,
        error: "No se pudo detectar estructura de datos válida",
        details: "El archivo no contiene una estructura reconocible de datos de Siigo",
        debugInfo: {
          totalRows: jsonData.length,
          totalColumns: jsonData[0]?.length || 0,
          extractionMethod: `Método ${extractionAttempts}`,
          sampleData,
          rangeInfo: {
            originalRange: XLSX.utils.encode_range(range),
            detectedDimensions: `${jsonData.length}x${jsonData[0]?.length || 0}`,
          },
        },
      }
    }

    // Usar la mejor estructura detectada
    const bestStructure = structureCandidates[0]
    console.log(`[v0] 🎯 Usando estructura con confianza: ${bestStructure.confidence.toFixed(3)}`)

    if (bestStructure.confidence < PROCESSING_CONFIG.MIN_CONFIDENCE_THRESHOLD) {
      return {
        success: false,
        filename: file.name,
        fileSize: file.size,
        error: "Confianza insuficiente en estructura detectada",
        details: `Confianza: ${bestStructure.confidence.toFixed(3)}, mínimo requerido: ${PROCESSING_CONFIG.MIN_CONFIDENCE_THRESHOLD}`,
        debugInfo: { bestStructure, allCandidates: structureCandidates },
      }
    }

    // Detectar tipo de documento
    const docType = detectDocumentTypeAdvanced(file.name, jsonData.slice(0, 20))
    console.log(`[v0] 📄 Tipo de documento detectado: ${docType} (${DOCUMENT_TYPE_NAMES[docType]})`)

    // Procesar datos
    let processedCount = 0
    let skippedCount = 0
    let totalValue = 0
    let fileMonth = -1
    let fileYear = new Date().getFullYear()
    const debugSamples: Array<Record<string, unknown>> = []
    const errorSamples: Array<{
      rowIndex: number;
      originalValue: string;
      parseMethod?: string;
      parseConfidence?: number;
      reason: string;
    }> = []

    console.log(`[v0] 🔄 Procesando filas ${bestStructure.dataStartRow + 1} a ${bestStructure.dataEndRow}`)

    // Procesar en chunks para archivos grandes
    const chunkSize = PROCESSING_CONFIG.CHUNK_SIZE
    const totalDataRows = bestStructure.dataEndRow - bestStructure.dataStartRow

    for (let chunkStart = bestStructure.dataStartRow; chunkStart < bestStructure.dataEndRow; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize, bestStructure.dataEndRow)

      for (let i = chunkStart; i < chunkEnd; i++) {
        const row = jsonData[i] || []

        // Verificar si la fila está completamente vacía
        if (row.every((cell) => !cell || String(cell).trim() === "")) {
          continue
        }

        // Parsear valor
        const valueCell = row[bestStructure.valueColumn] || ""
        const parseResult = parseColombianCurrencyRobust(valueCell)

        if (parseResult.value > 0 && parseResult.confidence >= 0.2) {
          // Parsear fecha si está disponible
          let rowDate: Date | null = null
          if (bestStructure.dateColumn >= 0 && bestStructure.dateColumn < row.length) {
            const dateCell = row[bestStructure.dateColumn]
            const dateResult = parseSiigoDateRobust(dateCell)
            rowDate = dateResult.date
          }

          // Usar fecha actual como fallback
          if (!rowDate) {
            rowDate = new Date()
          }

          const monthIndex = rowDate.getMonth()
          const year = rowDate.getFullYear()

          // Establecer mes y año del archivo basado en la primera fecha válida
          // Ajustar el mes para que sea 1-12 en lugar de 0-11
          if (fileMonth === -1) {
            fileMonth = monthIndex + 1 // Ajustar a 1-12
            fileYear = year
            console.log(`[v0] 📅 Mes/Año detectado: ${fileMonth}/${fileYear} (ajustado de ${monthIndex+1}/${year})`)
          }

          totalValue += parseResult.value
          processedCount++

          // Recopilar muestras para debugging
          if (debugSamples.length < 10) {
            debugSamples.push({
              rowIndex: i + 1,
              originalValue: parseResult.originalValue,
              parsedValue: parseResult.value,
              parseMethod: parseResult.method,
              parseConfidence: parseResult.confidence,
              date: rowDate.toISOString().split("T")[0],
              comprobante:
                bestStructure.comprobanteColumn >= 0 ? String(row[bestStructure.comprobanteColumn] || "") : "",
            })
          }
        } else {
          skippedCount++

          // Recopilar muestras de errores
          if (errorSamples.length < 5) {
            errorSamples.push({
              rowIndex: i + 1,
              originalValue: String(valueCell),
              parseMethod: parseResult.method,
              parseConfidence: parseResult.confidence,
              reason: parseResult.value === 0 ? "Valor cero o inválido" : "Confianza insuficiente",
            })
          }
        }
      }

      // Log de progreso para chunks grandes
      if (totalDataRows > chunkSize * 2) {
        const progress = (((chunkEnd - bestStructure.dataStartRow) / totalDataRows) * 100).toFixed(1)
        console.log(`[v0] 📈 Progreso: ${progress}% (${processedCount} procesadas, ${skippedCount} omitidas)`)
      }
    }

    const currentMemory = getMemoryUsage()
    const memoryUsed = currentMemory - startMemory

    console.log(`[v0] ✅ Procesamiento completado:`)
    console.log(`   📊 Filas procesadas: ${processedCount}`)
    console.log(`   ⏭️ Filas omitidas: ${skippedCount}`)
    console.log(`   💰 Valor total: ${formatCurrency(totalValue)}`)
    console.log(`   📅 Mes/Año: ${fileMonth + 1}/${fileYear}`)
    console.log(`   🧠 Memoria usada: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`)

    if (processedCount === 0) {
      return {
        success: false,
        filename: file.name,
        fileSize: file.size,
        error: "No se procesaron datos válidos",
        details: `Todas las ${skippedCount} filas fueron omitidas por valores inválidos`,
        debugInfo: {
          structure: bestStructure,
          errorSamples,
          totalRowsScanned: bestStructure.dataEndRow - bestStructure.dataStartRow,
        },
      }
    }

    return {
      success: true,
      filename: file.name,
      fileSize: file.size,
      documentType: docType,
      month: fileMonth,
      year: fileYear,
      totalValue: Number.parseFloat(totalValue.toFixed(2)),
      processed: processedCount,
      skipped: skippedCount,
      debugInfo: {
        structure: bestStructure,
        debugSamples,
        errorSamples: errorSamples.slice(0, 3), // Limitar para reducir tamaño
        memoryUsedMB: Number.parseFloat((memoryUsed / 1024 / 1024).toFixed(2)),
      },
    }
  } catch (error) {
    console.error(`[v0] ❌ Error crítico procesando ${file.name}:`, error)

    return {
      success: false,
      filename: file.name,
      fileSize: file.size,
      error: "Error de procesamiento",
      details: error instanceof Error ? error.message : "Error desconocido",
      debugInfo: {
        jsonDataLength: jsonData.length,
        jsonDataSample: jsonData.slice(0, 3),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    }
  }
}
