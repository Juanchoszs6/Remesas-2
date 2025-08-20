import { NextResponse } from 'next/server';
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

// Tipos de documentos soportados
type DocumentType = 'FC' | 'ND' | 'DS' | 'RP';

// Función mejorada para detectar el tipo de documento
const detectDocumentType = (row: any[], headers: string[]): DocumentType | null => {
  // Convertir toda la fila a string para búsqueda
  const rowText = row.map(cell => String(cell || '').toUpperCase().trim()).join(' ');
  
  console.log('Detectando tipo de documento en:', rowText);
  
  // Patrones de detección más específicos y flexibles
  const patterns = {
    'FC': [
      /\bFACTURA\b/i,
      /\bFC\b/,
      /^FC/,
      /FACTURA\s*DE?\s*COMPRA/i,
      /FACT\b/i
    ],
    'ND': [
      /\bNOTA\s*D[EÉ]BITO\b/i,
      /\bND\b/,
      /^ND/,
      /NOTA\s*DEB/i
    ],
    'DS': [
      /\bDOCUMENTO\s*SOPORTE\b/i,
      /\bDS\b/,
      /^DS/,
      /DOC\s*SOPORTE/i
    ],
    'RP': [
      /\bRECIBO\s*DE?\s*PAGO\b/i,
      /\bRP\b/,
      /^RP/,
      /RECIBO\s*PAG/i
    ]
  };
  
  // Buscar patrones en orden de prioridad
  for (const [type, typePatterns] of Object.entries(patterns)) {
    for (const pattern of typePatterns) {
      if (pattern.test(rowText)) {
        console.log(`Tipo de documento detectado: ${type} con patrón: ${pattern}`);
        return type as DocumentType;
      }
    }
  }
  
  // Búsqueda adicional por prefijos en las primeras columnas
  const firstThreeCells = row.slice(0, 3).map(cell => String(cell || '').toUpperCase().trim());
  
  for (const cell of firstThreeCells) {
    if (cell.startsWith('FC') || cell.includes('FACTURA')) return 'FC';
    if (cell.startsWith('ND') || cell.includes('NOTA')) return 'ND';
    if (cell.startsWith('DS') || cell.includes('DOCUMENTO')) return 'DS';
    if (cell.startsWith('RP') || cell.includes('RECIBO')) return 'RP';
  }
  
  console.log('No se pudo detectar el tipo de documento');
  return null;
};

// Función para parsear fechas de manera más robusta
const parseDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  
  console.log('Parseando fecha:', dateValue, 'Tipo:', typeof dateValue);
  
  let date: Date | null = null;
  
  try {
    // Si ya es una fecha
    if (dateValue instanceof Date) {
      date = new Date(dateValue);
    }
    // Si es un número (fecha de Excel)
    else if (typeof dateValue === 'number') {
      // Convertir fecha de Excel a JavaScript
      // Excel cuenta días desde 1900-01-01, pero con error de año bisiesto
      const excelDate = dateValue;
      const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
      date = jsDate;
    }
    // Si es string
    else if (typeof dateValue === 'string') {
      const cleanDateStr = dateValue.trim();
      
      // Intentar diferentes formatos
      // Formato ISO
      date = new Date(cleanDateStr);
      
      if (isNaN(date.getTime())) {
        // Intentar formatos DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
        const dateRegex = /(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})/;
        const match = cleanDateStr.match(dateRegex);
        
        if (match) {
          let [, part1, part2, part3] = match;
          let day, month, year;
          
          // Determinar formato basado en la longitud y valores
          if (part1.length === 4) {
            // YYYY-MM-DD
            year = parseInt(part1);
            month = parseInt(part2) - 1; // JavaScript usa 0-11
            day = parseInt(part3);
          } else if (part3.length === 4) {
            // DD/MM/YYYY o MM/DD/YYYY
            const val1 = parseInt(part1);
            const val2 = parseInt(part2);
            year = parseInt(part3);
            
            // Si el primer valor es mayor que 12, es DD/MM/YYYY
            if (val1 > 12) {
              day = val1;
              month = val2 - 1;
            }
            // Si el segundo valor es mayor que 12, es MM/DD/YYYY
            else if (val2 > 12) {
              month = val1 - 1;
              day = val2;
            }
            // Asumir DD/MM/YYYY por defecto para Colombia
            else {
              day = val1;
              month = val2 - 1;
            }
          }
          
          if (year && month !== undefined && day) {
            // Ajustar año de 2 dígitos
            if (year < 100) {
              year = year < 50 ? 2000 + year : 1900 + year;
            }
            
            date = new Date(year, month, day);
          }
        }
      }
    }
    
    // Validar que la fecha sea válida y esté en un rango razonable
    if (date && !isNaN(date.getTime())) {
      const year = date.getFullYear();
      if (year >= 2000 && year <= 2030) {
        console.log('Fecha parseada correctamente:', date.toISOString().split('T')[0]);
        return date;
      }
    }
  } catch (error) {
    console.error('Error parseando fecha:', error);
  }
  
  console.warn('No se pudo parsear la fecha:', dateValue);
  return null;
};

// Función para parsear valores monetarios
const parseValue = (valueInput: any): number => {
  if (typeof valueInput === 'number') {
    return valueInput;
  }
  
  if (typeof valueInput === 'string') {
    // Limpiar el string: remover símbolos de moneda, espacios, etc.
    let cleanValue = valueInput
      .replace(/[$€£¥₹₽]/g, '') // Símbolos de moneda
      .replace(/[^\d,.-]/g, '') // Solo números, comas, puntos, guión
      .trim();
    
    // Manejar formatos con comas y puntos
    // Si hay tanto comas como puntos, asumir que el último es decimal
    if (cleanValue.includes(',') && cleanValue.includes('.')) {
      const lastComma = cleanValue.lastIndexOf(',');
      const lastDot = cleanValue.lastIndexOf('.');
      
      if (lastDot > lastComma) {
        // Formato: 1,234.56
        cleanValue = cleanValue.replace(/,/g, '');
      } else {
        // Formato: 1.234,56
        cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
      }
    }
    // Si solo hay comas, convertir a punto decimal
    else if (cleanValue.includes(',') && !cleanValue.includes('.')) {
      // Verificar si es separador de miles o decimal
      const commaIndex = cleanValue.lastIndexOf(',');
      const afterComma = cleanValue.substring(commaIndex + 1);
      
      // Si después de la coma hay exactamente 2 dígitos, es decimal
      if (afterComma.length <= 2) {
        cleanValue = cleanValue.replace(',', '.');
      } else {
        cleanValue = cleanValue.replace(/,/g, '');
      }
    }
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : Math.abs(parsed); // Usar valor absoluto
  }
  
  return 0;
};

export async function POST(request: Request) {
  let processedRows = 0;
  let skippedRows = 0;
  let headers: string[] = [];
  let headerRowIndex = -1;
  
  // Inicializar estructura para los datos procesados
  const processedData: Record<DocumentType, ProcessedData> = {
    FC: { values: Array(12).fill(0), total: 0 },
    ND: { values: Array(12).fill(0), total: 0 },
    DS: { values: Array(12).fill(0), total: 0 },
    RP: { values: Array(12).fill(0), total: 0 }
  };

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

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

    console.log(`Procesando archivo: ${file.name} (${file.size} bytes)`);

    // Leer el archivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'buffer',
      cellDates: true,
      cellText: false
    });
    
    // Obtener la primera hoja
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    console.log(`Procesando hoja: ${firstSheetName}`);
    
    // Convertir a JSON con opciones optimizadas
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { 
      header: 1, 
      defval: '',
      blankrows: false,
      raw: false
    });
    
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

    // Buscar la fila de encabezados de manera más flexible
    const requiredHeaders = ['fecha', 'valor'];
    const optionalHeaders = ['comprobante', 'factura', 'documento', 'tipo'];
    
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i] || [];
      const normalizedRow = row.map((cell: any) => normalizeHeader(String(cell || '')));
      
      // Verificar si esta fila contiene los encabezados requeridos
      const hasRequiredHeaders = requiredHeaders.every(required => 
        normalizedRow.some(header => header.includes(required))
      );
      
      if (hasRequiredHeaders) {
        headerRowIndex = i;
        headers = normalizedRow;
        console.log(`Encabezados encontrados en fila ${i + 1}:`, headers);
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No se encontraron encabezados válidos',
          details: `Se requieren columnas con: ${requiredHeaders.join(', ')}`,
          sampleData: jsonData.slice(0, 5)
        },
        { status: 400 }
      );
    }

    // Encontrar índices de columnas
    const findColumnIndex = (patterns: string[]): number => {
      for (const pattern of patterns) {
        const index = headers.findIndex(h => h.includes(pattern));
        if (index !== -1) return index;
      }
      return -1;
    };

    const fechaIndex = findColumnIndex(['fecha', 'date']);
    const valorIndex = findColumnIndex(['valor', 'monto', 'total', 'importe']);
    
    if (fechaIndex === -1 || valorIndex === -1) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Columnas requeridas no encontradas',
          details: `Se requieren columnas de fecha y valor. Encabezados: ${headers.join(', ')}`,
          headers: headers
        },
        { status: 400 }
      );
    }

    console.log(`Índices de columnas - Fecha: ${fechaIndex}, Valor: ${valorIndex}`);

    // Procesar filas de datos
    const dataRows = jsonData.slice(headerRowIndex + 1);
    console.log(`Procesando ${dataRows.length} filas de datos`);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      if (!row || row.length === 0 || row.every(cell => !cell)) {
        skippedRows++;
        continue;
      }

      try {
        // Detectar tipo de documento
        const docType = detectDocumentType(row, headers);
        
        if (!docType) {
          console.log(`Fila ${i + 1}: Tipo de documento no detectado, saltando`);
          skippedRows++;
          continue;
        }

        // Parsear fecha
        const date = parseDate(row[fechaIndex]);
        
        if (!date) {
          console.log(`Fila ${i + 1}: Fecha inválida, saltando`);
          skippedRows++;
          continue;
        }

        // Parsear valor
        const value = parseValue(row[valorIndex]);
        
        if (value <= 0) {
          console.log(`Fila ${i + 1}: Valor inválido (${value}), saltando`);
          skippedRows++;
          continue;
        }

        // Obtener mes (0-11)
        const month = date.getMonth();
        const year = date.getFullYear();
        
        // Validar año
        if (year < 2020 || year > 2030) {
          console.log(`Fila ${i + 1}: Año fuera de rango (${year}), saltando`);
          skippedRows++;
          continue;
        }

        // Actualizar datos procesados
        processedData[docType].values[month] += value;
        processedData[docType].total += value;

        console.log(`Fila ${i + 1} procesada: ${docType}, ${date.toISOString().split('T')[0]}, $${value.toLocaleString()}`);
        processedRows++;

      } catch (error) {
        console.error(`Error procesando fila ${i + 1}:`, error);
        skippedRows++;
      }
    }

    console.log(`Procesamiento completado: ${processedRows} filas procesadas, ${skippedRows} filas saltadas`);

    // Verificar si se procesaron datos
    if (processedRows === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No se procesaron datos válidos',
          details: 'Verifique que el archivo contenga datos con el formato correcto',
          debug: {
            headers,
            sampleRows: dataRows.slice(0, 3)
          }
        },
        { status: 400 }
      );
    }

    // Mostrar resumen de datos procesados
    console.log('Resumen de datos procesados:');
    Object.entries(processedData).forEach(([type, data]) => {
      if (data.total > 0) {
        console.log(`${type}: $${data.total.toLocaleString()} total`);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        FC: processedData.FC,
        ND: processedData.ND,
        DS: processedData.DS,
        RP: processedData.RP,
        _debug: {
          processedRows,
          skippedRows,
          headerRow: headers,
          headerRowIndex: headerRowIndex + 1
        }
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error al procesar el archivo:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al procesar el archivo',
        details: errorMessage,
        processedRows,
        skippedRows
      },
      { status: 500 }
    );
  }
}