import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Función para normalizar texto de encabezado
const normalizeHeader = (text: string): string => {
  if (!text) return '';
  return text.toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .trim()
    .replace(/\s+/g, ' '); // Normalizar espacios
};

// Interfaz para los datos procesados
interface ProcessedData {
  values: number[];
  total: number;
}

// Tipos de documentos soportados para Siigo
type DocumentType = 'FC' | 'ND' | 'DS' | 'RP';

const documentTypeNames = {
  'FC': 'Factura de Compra',
  'ND': 'Nota Débito',
  'DS': 'Documento Soporte', 
  'RP': 'Recibo de Pago'
};

// Función mejorada para detectar el tipo de documento desde los datos de Siigo
const detectDocumentTypeFromSiigo = (row: any[], headers: string[]): DocumentType | null => {
  // Buscar en la columna que contenga "Factura" o "comprobante" 
  const facturaIndex = headers.findIndex(h => 
    h && (h.includes('factura') || h.includes('comprobante') || h.includes('documento'))
  );
  
  if (facturaIndex !== -1 && row[facturaIndex]) {
    const facturaValue = String(row[facturaIndex]).toUpperCase().trim();
    console.log('Analizando comprobante:', facturaValue);
    
    // Detectar por prefijo del número de factura/comprobante
    if (facturaValue.startsWith('FC-') || facturaValue.includes('FC-')) return 'FC';
    if (facturaValue.startsWith('ND-') || facturaValue.includes('ND-')) return 'ND';
    if (facturaValue.startsWith('DS-') || facturaValue.includes('DS-')) return 'DS';
    if (facturaValue.startsWith('RP-') || facturaValue.includes('RP-')) return 'RP';
  }
  
  // Buscar en cualquier columna el patrón
  const rowText = row.map(cell => String(cell || '').toUpperCase().trim()).join(' ');
  
  // Patrones específicos para Siigo
  if (/FC-\d+/.test(rowText)) return 'FC';
  if (/ND-\d+/.test(rowText)) return 'ND'; 
  if (/DS-\d+/.test(rowText)) return 'DS';
  if (/RP-\d+/.test(rowText)) return 'RP';
  
  console.log('No se pudo detectar el tipo de documento para:', rowText.substring(0, 100));
  return null;
};

// Función para parsear fechas de Siigo (DD/MM/YYYY)
const parseSiigoDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  
  console.log('Parseando fecha Siigo:', dateValue, 'Tipo:', typeof dateValue);
  
  try {
    // Si ya es una fecha
    if (dateValue instanceof Date) {
      return new Date(dateValue);
    }
    
    // Si es un número (fecha de Excel)
    if (typeof dateValue === 'number') {
      const jsDate = new Date((dateValue - 25569) * 86400 * 1000);
      return jsDate;
    }
    
    // Si es string con formato DD/MM/YYYY (formato colombiano)
    if (typeof dateValue === 'string') {
      const cleanDateStr = dateValue.trim();
      
      // Formato DD/MM/YYYY o DD/MM/YY
      const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
      const match = cleanDateStr.match(dateRegex);
      
      if (match) {
        let [, day, month, year] = match;
        let yearNum = parseInt(year);
        
        // Ajustar año de 2 dígitos
        if (yearNum < 100) {
          yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
        }
        
        const date = new Date(yearNum, parseInt(month) - 1, parseInt(day));
        
        if (!isNaN(date.getTime()) && yearNum >= 2020 && yearNum <= 2030) {
          console.log('Fecha Siigo parseada:', date.toISOString().split('T')[0]);
          return date;
        }
      }
    }
  } catch (error) {
    console.error('Error parseando fecha Siigo:', error);
  }
  
  return null;
};

// Función para parsear valores monetarios de Siigo
const parseSiigoValue = (valueInput: any): number => {
  if (typeof valueInput === 'number') {
    return Math.abs(valueInput);
  }
  
  if (typeof valueInput === 'string') {
    // Formato colombiano: 1.234.567,89 o 1,234,567.89
    let cleanValue = valueInput
      .replace(/[$€£¥₹₽COP]/g, '') // Símbolos de moneda
      .replace(/\s+/g, '') // Espacios
      .trim();
    
    // Si termina en ,00 o tiene formato 1.234.567,89
    if (/\d+\.\d{3},\d{2}$/.test(cleanValue) || /\d+,\d{2}$/.test(cleanValue)) {
      // Formato colombiano: separador de miles con punto, decimal con coma
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    }
    // Si es formato americano: 1,234,567.89
    else if (/\d+,\d{3}\.\d{2}$/.test(cleanValue)) {
      cleanValue = cleanValue.replace(/,/g, '');
    }
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }
  
  return 0;
};

export const dynamic = 'force-dynamic';

// Función para manejar CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET() {
  console.log('=== PRUEBA DE CONEXIÓN A /api/analytics/process ===');
  
  const testData = {
    success: true,
    message: '¡La API está funcionando correctamente!',
    timestamp: new Date().toISOString(),
    endpoints: {
      GET: 'Prueba de conexión',
      POST: 'Procesar archivo Excel de Siigo'
    },
    instrucciones: {
      prueba: 'Enviar una solicitud POST con un archivo Excel en el campo "file"',
      ejemplo_curl: 'curl -X POST -F "file=@ruta/a/tu/archivo.xlsx" http://localhost:3000/api/analytics/process'
    }
  };

  return new Response(JSON.stringify(testData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    },
  });
}

export async function POST(request: NextRequest) {
  console.log('=== INICIO DE SOLICITUD A /api/analytics/process ===');
  console.log('Método de solicitud:', request.method);
  
  // Verificar si es una solicitud OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    console.log('Solicitud OPTIONS recibida, enviando encabezados CORS');
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  
  // Verificar si es una solicitud POST
  if (request.method !== 'POST') {
    console.log('Método no permitido:', request.method);
    return NextResponse.json(
      { success: false, error: 'Método no permitido' },
      { status: 405, headers: { 'Allow': 'POST' } }
    );
  }
  let processedRows = 0;
  let skippedRows = 0;
  let headers: string[] = [];
  let headerRowIndex = -1;
  let headerRow: any[] = []; // Add this line
  
  // Inicializar estructura para los datos procesados
  const processedData: Record<DocumentType, ProcessedData> = {
    FC: { values: Array(12).fill(0), total: 0 },
    ND: { values: Array(12).fill(0), total: 0 },
    DS: { values: Array(12).fill(0), total: 0 },
    RP: { values: Array(12).fill(0), total: 0 }
  };

  try {
    console.log('Obteniendo FormData de la solicitud');
    let formData;
    try {
      formData = await request.formData();
      console.log('FormData obtenido correctamente');
    } catch (error) {
      console.error('Error al obtener FormData:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error al procesar el formulario',
          details: error instanceof Error ? error.message : 'Error desconocido'
        },
        { status: 400 }
      );
    }
    
    const file = formData.get('file') as File | null;
    console.log('Archivo recibido:', file ? `${file.name} (${file.size} bytes)` : 'Ningún archivo recibido');

    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No se proporcionó ningún archivo',
          details: 'Por favor, seleccione un archivo para procesar'
        },
        { status: 400 }
      );
    }

    console.log(`Procesando archivo Siigo: ${file.name} (${file.size} bytes)`);

    // Leer el archivo Excel de manera directa
    const arrayBuffer = await file.arrayBuffer();
    
    // Opción 1: Intentar leer como binario simple
    let workbook;
    try {
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellText: true,
        raw: false,
        cellFormula: false,
        cellNF: false,
        cellStyles: false
      });
    } catch (error) {
      console.error('Error al leer el archivo con opciones estándar:', error);
      
      // Opción 2: Intentar con opciones alternativas
      try {
        console.log('Intentando con configuración alternativa...');
        workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          raw: true,  // Probar con raw:true
          cellDates: false,
          cellText: false
        });
      } catch (secondError) {
        console.error('Error en segundo intento de lectura:', secondError);
        throw new Error('No se pudo leer el archivo Excel con ninguna configuración');
      }
    }
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    console.log(`Procesando hoja: ${firstSheetName}`);
    
    // Obtener el rango de celdas
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    console.log(`Rango de datos: ${XLSX.utils.encode_range(range)}`);
    
    // Leer datos manualmente
    const jsonData = [];
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const row = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = { r: R, c: C };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        const cell = worksheet[cellRef];
        row.push(cell ? cell.w || cell.v || '' : '');
      }
      jsonData.push(row);
    }
    
    // Mostrar información del archivo
    console.log('\n=== INFORMACIÓN DEL ARCHIVO ===');
    console.log(`- Total de filas: ${jsonData.length}`);
    console.log(`- Total de columnas: ${jsonData[0]?.length || 0}`);
    
    // Mostrar las primeras 10 filas con detalle
    console.log('\n=== PRIMERAS 10 FILAS ===');
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i] || [];
      console.log(`\nFila ${i + 1} (${row.length} columnas):`);
      row.forEach((cell, idx) => {
        console.log(`  ${String.fromCharCode(65 + idx)}: '${cell}'`);
      });
    }
    
    // Mostrar información de depuración
    console.log('Primeras 15 filas completas:');
    for (let i = 0; i < Math.min(15, jsonData.length); i++) {
      console.log(`Fila ${i + 1}:`, jsonData[i]);
    }
    
    console.log(`Total de filas leídas: ${jsonData.length}`);
    
    if (jsonData.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'El archivo está vacío',
          details: 'No se encontraron datos en el archivo Excel'
        },
        { status: 400 }
      );
    }

    // Intentar encontrar la fila de encabezados de manera más flexible
    const possibleHeaders = [
      'factura', 'comprobante', 'documento', 'nro', 'número',
      'fecha', 'elaboracion', 'emision',
      'valor', 'total', 'importe', 'monto',
      'proveedor', 'vendedor', 'nombre',
      'identificacion', 'nit', 'ruc', 'documento'
    ];
    
    // Procesar fila 7 (A7:K7) como encabezados
    headerRowIndex = 6; // Fila 7 en Excel (0-based)
    
    if (jsonData.length <= headerRowIndex) {
      console.error('El archivo no tiene suficientes filas. Se esperaba al menos', headerRowIndex + 1, 'filas');
      return NextResponse.json(
        { 
          success: false,
          error: 'Formato de archivo no válido',
          details: `No se encontró la fila de encabezados (fila 7). El archivo solo tiene ${jsonData.length} filas.`,
          debug: {
            totalFilas: jsonData.length,
            primerasFilas: jsonData.slice(0, 10) // Mostrar primeras 10 filas para depuración
          }
        },
        { status: 400 }
      );
    }

    // Usar la variable headerRow ya declarada
    headerRow = jsonData[headerRowIndex] || [];
    headers = headerRow.map((cell: any) => String(cell || '').trim());
    
    console.log('Encabezados encontrados en fila 7 (A7:K7):', headers);
    
    // Mapeo de columnas basado en la estructura del archivo
    const columnIndices = {
      tipoTransaccion: 0,    // Columna A: Tipo de transacción
      comprobante: 1,        // Columna B: Comprobante (ej: FC-17-250)
      facturaProveedor: 2,   // Columna C: Factura proveedor
      fechaElaboracion: 3,   // Columna D: Fecha elaboración (31/03/2025)
      identificacion: 4,      // Columna E: Identificación
      sucursal: 5,           // Columna F: Sucursal
      proveedor: 6,           // Columna G: Proveedor
      estadoCorreo: 7,        // Columna H: Estado envío de correo
      valor: 8,               // Columna I: Valor (1.078.000,00)
      moneda: 9               // Columna J: Moneda (COP)
    };

    // Inicializar estructura para los datos procesados
    const processedData: Record<DocumentType, ProcessedData> = {
      FC: { values: Array(12).fill(0), total: 0 },
      ND: { values: Array(12).fill(0), total: 0 },
      DS: { values: Array(12).fill(0), total: 0 },
      RP: { values: Array(12).fill(0), total: 0 }
    };

    // Mostrar las primeras 10 filas para depuración
    console.log('Primeras 10 filas del archivo:');
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      console.log(`Fila ${i + 1}:`, jsonData[i]);
    }
    
    // Procesar filas de datos (empezando desde la fila 8)
    const dataStartRow = 6; // Fila 7 (0-based) donde están los encabezados
    const dataRows = [];
    
    // Mostrar las primeras 10 filas completas para depuración
    console.log('Primeras 10 filas completas:');
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      console.log(`Fila ${i + 1}:`, jsonData[i]);
    }

    // Mostrar información detallada de las primeras 20 filas
    console.log('\n=== ANÁLISIS DETALLADO DE FILAS ===');
    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
      const row = jsonData[i] || [];
      console.log(`\n--- Fila ${i + 1} (${row.length} columnas) ---`);
      
      // Mostrar cada celda con su letra de columna
      row.forEach((cell, idx) => {
        console.log(`  ${String.fromCharCode(65 + idx)}: '${cell}'`);
      });
      
      // Verificar si esta fila parece ser la de encabezados
      const rowText = row.join('|').toLowerCase();
      const possibleHeaders = [
        'compra/gasto', 'comprobante', 'factura', 'fecha', 'proveedor', 'valor',
        'tipo', 'transacción', 'documento', 'soporte', 'identificación', 'nit',
        'sucursal', 'estado', 'correo', 'moneda', 'elaboración', 'emisión'
      ];
      
      const matchingHeaders = possibleHeaders.filter(header => 
        rowText.includes(header.toLowerCase())
      );
      
      if (matchingHeaders.length > 0) {
        console.log(`  ¡POSIBLES ENCABEZADOS DETECTADOS: ${matchingHeaders.join(', ')}`);
        if (matchingHeaders.length >= 3) {  // Si encontramos al menos 3 coincidencias
          headerRow = row;
          headerRowIndex = i;
          console.log(`\n=== ENCABEZADOS IDENTIFICADOS EN FILA ${i + 1} ===`);
          headerRow.forEach((h, idx) => 
            console.log(`  ${String.fromCharCode(65 + idx)}: '${h}'`)
          );
          console.log('=================================\n');
          break;
        }
      }
    }
    
    // Si no encontramos la fila de encabezados, usar la fila 7 por defecto
    if (headerRow.length === 0) {
      headerRow = jsonData[6] || [];
      headerRowIndex = 6;
      console.log('Usando fila 7 como encabezados por defecto:', headerRow);
    }
    
    // Obtener las filas de datos (empezando después de los encabezados)
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] || [];
      if (row.length > 0 && !row.every(cell => !cell || String(cell).trim() === '')) {
        dataRows.push(row);
      }
    }
    
    console.log(`Procesando ${dataRows.length} filas de datos a partir de la fila ${dataStartRow + 1}`);
    
    // Mostrar información de depuración
    console.log('Primeras 3 filas de datos:', dataRows.slice(0, 3));
    
    // Si no hay filas de datos, devolver error
    if (dataRows.length === 0) {
      console.error('No se encontraron filas de datos válidas después de la fila de encabezados');
      console.log('Total de filas en el archivo:', jsonData.length);
      console.log('Fila de encabezados:', jsonData[headerRowIndex]);
      console.log('Primeras 10 filas completas:', jsonData.slice(0, 10));
      
      return NextResponse.json(
        { 
          success: false,
          error: 'No se encontraron datos para procesar',
          details: 'El archivo no contiene filas de datos válidas después de la fila de encabezados',
          debug: {
            totalFilas: jsonData.length,
            headerRow: jsonData[headerRowIndex],
            primerasFilas: jsonData.slice(0, 10)
          }
        },
        { status: 400 }
      );
    }
    
    console.log(`Procesando ${dataRows.length} filas de datos a partir de la fila ${dataStartRow + 1}`);
    
    // Procesar cada fila de datos
    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = dataStartRow + i;
      let row = dataRows[i] || [];
      
      // Asegurarse de que todas las columnas necesarias estén definidas
      if (!Array.isArray(row)) {
        row = [row]; // Convertir a array si es una sola celda
      }
      
      // Mostrar información de depuración para las primeras filas
      if (i < 3) {
        console.log(`Fila ${rowIndex + 1}:`, row);
      }
      
      // Verificar que la fila tenga datos
      if (!row || row.length === 0) {
        console.log(`Fila ${rowIndex + 1}: Fila vacía, saltando...`);
        skippedRows++;
        continue;
      }
      
      // Verificar que la fila tenga suficientes columnas
      if (row.length < 5) { // Mínimo 5 columnas esperadas
        console.log(`Fila ${rowIndex + 1}: Fila con formato incorrecto, saltando...`, row);
        skippedRows++;
        continue;
      }
      
      try {
        // Extraer valores de la fila con manejo de errores
        let comprobante = '';
        let fechaElaboracion = null;
        let valorStr = '0';
        
        try {
          comprobante = String(row[columnIndices.comprobante] || '').trim();
          fechaElaboracion = row[columnIndices.fechaElaboracion];
          valorStr = String(row[columnIndices.valor] || '0').trim();
          
          // Validar valores requeridos
          if (!comprobante) {
            throw new Error('Comprobante faltante');
          }
          if (!fechaElaboracion) {
            throw new Error('Fecha de elaboración faltante');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Error al extraer datos de la fila';
          console.log(`Fila ${rowIndex + 1}: ${errorMsg}, saltando...`, row);
          skippedRows++;
          continue;
        }
        
        // Determinar tipo de documento basado en el prefijo del comprobante
        let docType: DocumentType = 'FC'; // Por defecto Factura de Compra
        const prefijo = comprobante.split('-')[0].toUpperCase();
        
        if (['FC', 'ND', 'DS', 'RP'].includes(prefijo)) {
          docType = prefijo as DocumentType;
        } else if (comprobante.match(/^ND/i)) {
          docType = 'ND';
        } else if (comprobante.match(/^DS/i)) {
          docType = 'DS';
        } else if (comprobante.match(/^RP/i)) {
          docType = 'RP';
        }
        
        // Convertir valor numérico (manejar formato 1.078.000,00)
        const valor = parseFloat(
          valorStr
            .replace(/\./g, '')  // Eliminar puntos de miles
            .replace(',', '.')    // Reemplazar coma decimal por punto
        ) || 0;
        
        // Procesar fecha de elaboración (formato DD/MM/YYYY)
        let month = 0; // Por defecto enero
        let date: Date | null = null;
        
        try {
          if (fechaElaboracion) {
            // Intentar parsear fecha en formato DD/MM/YYYY
            const dateStr = String(fechaElaboracion).trim();
            const [day, monthStr, year] = dateStr.split('/').map(Number);
            
            if (day && monthStr && year) {
              date = new Date(year, monthStr - 1, day);
              if (!isNaN(date.getTime())) {
                month = date.getMonth(); // 0-11
                
                // Validar año
                if (year < 2020 || year > 2030) {
                  console.log(`Fila ${dataStartRow + i + 1}: Año fuera de rango (${year}), saltando`);
                  skippedRows++;
                  continue;
                }
              } else {
                throw new Error('Fecha inválida');
              }
            } else {
              throw new Error('Formato de fecha no reconocido');
            }
          } else {
            throw new Error('Fecha faltante');
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
          console.log(`Fila ${dataStartRow + i + 1}: ${errorMessage} (${fechaElaboracion}), saltando`);
          skippedRows++;
          continue;
        }
        
        // Actualizar totales solo si el valor es mayor a cero
        if (valor > 0) {
          processedData[docType].values[month] += valor;
          processedData[docType].total += valor;
          processedRows++;
        } else {
          console.log(`Fila ${dataStartRow + i + 1}: Valor cero o inválido, saltando`);
          skippedRows++;
          continue;
        }
        
        if (processedRows < 5) {
          console.log(`Fila ${dataStartRow + i + 1} procesada: ${docType}, ${date.toISOString().split('T')[0]}, $${valor.toLocaleString()}`);
        }
        
      } catch (error) {
        console.error(`Error al procesar fila ${dataStartRow + i + 1}:`, error);
        skippedRows++;
      }
    }
    
    console.log('Resumen de procesamiento:');
    console.log('- Filas procesadas:', processedRows);
    console.log('- Filas omitidas:', skippedRows);
    console.log('Datos procesados:', processedData);
    
    // Verificar si se procesaron datos
    if (processedRows === 0) {
      console.error('No se procesó ninguna fila. Total de filas procesadas:', processedRows);
      console.error('Primeras 3 filas de datos:', dataRows.slice(0, 3));
      
      return NextResponse.json(
        { 
          success: false,
          error: 'No se procesaron datos válidos de Siigo',
          details: 'Verifique que el archivo contenga datos con prefijos FC-, ND-, DS-, RP-',
          debug: {
            totalFilas: dataRows.length,
            headers: headers.map((h, i) => `${i}: ${h}`),
            sampleRows: dataRows.slice(0, 3).map((row, idx) => ({
              rowNumber: dataStartRow + idx + 1,
              data: row.map((cell, cellIdx) => ({
                col: String.fromCharCode(65 + cellIdx), // A, B, C, ...
                value: cell
              }))
            })),
            processedData
          }
        },
        { status: 400 }
      );
    }
    
    // Mostrar resumen en consola
    console.log('=== RESUMEN DEL PROCESAMIENTO ===');
    console.log(`- Total de filas procesadas: ${processedRows}`);
    console.log(`- Filas saltadas: ${skippedRows}`);
    console.log('Datos procesados por tipo:');
    
    Object.entries(processedData).forEach(([type, data]) => {
      if (data.total > 0) {
        console.log(`  - ${documentTypeNames[type as DocumentType] || type}: $${data.total.toLocaleString()}`);
      }
    });
    
    // Retornar los datos procesados
    const responseData = {
      success: true,
      message: `Procesados ${processedRows} registros exitosamente`,
      data: processedData,
      stats: {
        processed: processedRows,
        skipped: skippedRows,
        total: processedRows + skippedRows,
        startRow: dataStartRow + 1,
        endRow: dataStartRow + dataRows.length
      },
      timestamp: new Date().toISOString(),
      debug: {
        headers: headers.map((h, i) => `${i}: ${h}`),
        firstProcessedRow: dataRows[0],
        lastProcessedRow: dataRows[dataRows.length - 1]
      }
    };
    
    console.log('Enviando respuesta exitosa:', JSON.stringify(responseData, null, 2));
    
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error al procesar archivo Siigo:', error);
    
    const errorResponse = { 
      success: false,
      error: 'Error al procesar el archivo Siigo',
      details: errorMessage,
      processedRows,
      skippedRows,
      timestamp: new Date().toISOString()
    };
    
    console.error('Enviando respuesta de error:', JSON.stringify(errorResponse, null, 2));
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}