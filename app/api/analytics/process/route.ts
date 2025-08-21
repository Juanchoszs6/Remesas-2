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

export async function POST(request: NextRequest) {
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

    console.log(`Procesando archivo Siigo: ${file.name} (${file.size} bytes)`);

    // Leer el archivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'buffer',
      cellDates: true,
      cellText: false
    });
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    console.log(`Procesando hoja Siigo: ${firstSheetName}`);
    
    // Convertir a JSON
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

    // Intentar encontrar la fila de encabezados de manera más flexible
    const possibleHeaders = [
      'factura', 'comprobante', 'documento', 'nro', 'número',
      'fecha', 'elaboracion', 'emision',
      'valor', 'total', 'importe', 'monto',
      'proveedor', 'vendedor', 'nombre',
      'identificacion', 'nit', 'ruc', 'documento'
    ];
    
    // Buscar en las primeras 10 filas
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i] || [];
      const normalizedRow = row.map((cell: any) => normalizeHeader(String(cell || '')));
      
      // Contar coincidencias con posibles encabezados
      const matchCount = normalizedRow.filter(header => 
        possibleHeaders.some(ph => header.includes(ph))
      ).length;
      
      // Si encontramos al menos 3 coincidencias, asumimos que son los encabezados
      if (matchCount >= 3) {
        headerRowIndex = i;
        headers = normalizedRow;
        console.log(`Posibles encabezados encontrados en fila ${i + 1}:`, headers);
        break;
      }
    }
    
    // Si no encontramos encabezados, usar la primera fila
    if (headerRowIndex === -1 && jsonData.length > 0) {
      console.log('No se encontraron encabezados claros, usando primera fila');
      headerRowIndex = 0;
      headers = (jsonData[0] || []).map((cell: any) => String(cell || '').trim());
    }
    
    if (headers.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No se pudieron determinar los encabezados',
          details: 'El archivo no contiene una estructura de datos reconocible',
          sampleData: jsonData.slice(0, 5)
        },
        { status: 400 }
      );
    }

    // Función para encontrar el mejor índice de columna basado en palabras clave
    const findBestColumnIndex = (keywords: string[]): number => {
      const scores = headers.map(header => {
        const headerLower = header.toLowerCase();
        return keywords.reduce((score, keyword) => 
          headerLower.includes(keyword) ? score + 1 : score, 0);
      });
      
      const maxScore = Math.max(...scores);
      return maxScore > 0 ? scores.indexOf(maxScore) : -1;
    };
    
    // Encontrar índices de columnas de manera flexible
    const facturaIndex = findBestColumnIndex(['factura', 'comprobante', 'documento', 'nro', 'número']);
    const fechaIndex = findBestColumnIndex(['fecha', 'elaboracion', 'emision', 'creacion']);
    const valorIndex = findBestColumnIndex(['valor', 'total', 'importe', 'monto', 'amount']);
    const proveedorIndex = findBestColumnIndex(['proveedor', 'vendedor', 'nombre', 'name', 'supplier']);
    const identificacionIndex = findBestColumnIndex(['identificacion', 'nit', 'ruc', 'documento', 'id']);
    
    console.log('Índices detectados:', {
      facturaIndex,
      fechaIndex,
      valorIndex,
      proveedorIndex,
      identificacionIndex,
      headers
    });
    
    // Verificar columnas requeridas mínimas
    const missingColumns = [];
    if (facturaIndex === -1) missingColumns.push('Factura/Comprobante');
    if (fechaIndex === -1) missingColumns.push('Fecha');
    if (valorIndex === -1) missingColumns.push('Valor/Total');
    
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Faltan columnas requeridas',
          details: `No se pudieron identificar las columnas para: ${missingColumns.join(', ')}`,
          headers: headers.map((h, i) => `${i}: ${h}`),
          sampleData: jsonData.slice(0, 5)
        },
        { status: 400 }
      );
    }

    // Procesar filas de datos
    const dataRows = jsonData.slice(headerRowIndex + 1);
    console.log(`Procesando ${dataRows.length} filas de datos Siigo`);
    
    // Contador para filas procesadas correctamente
    let validRows = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] || [];
      
      // Saltar filas vacías
      if (row.every(cell => cell === '' || cell === null || cell === undefined)) {
        console.log(`Fila ${i + headerRowIndex + 2} vacía, omitiendo`);
        skippedRows++;
        continue;
      }
      
      try {
        // Verificar filas con datos faltantes críticos
        if (!row[facturaIndex] || !row[fechaIndex] || !row[valorIndex]) {
          console.log(`Fila ${i + headerRowIndex + 2} falta información crítica, omitiendo:`, {
            factura: row[facturaIndex],
            fecha: row[fechaIndex],
            valor: row[valorIndex]
          });
          skippedRows++;
          continue;
        }

        // Detectar tipo de documento
        const docType = detectDocumentTypeFromSiigo(row, headers);
        
        if (!docType) {
          console.log(`Fila ${i + 1}: Tipo de documento no detectado, saltando`);
          skippedRows++;
          continue;
        }

        // Parsear fecha
        const date = parseSiigoDate(row[fechaIndex]);
        
        if (!date) {
          console.log(`Fila ${i + 1}: Fecha inválida, saltando`);
          skippedRows++;
          continue;
        }

        // Parsear valor
        const value = parseSiigoValue(row[valorIndex]);
        
        if (value <= 0) {
          console.log(`Fila ${i + 1}: Valor inválido (${row[valorIndex]}), saltando`);
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

        if (processedRows < 5) {
          console.log(`Fila ${i + 1} procesada: ${docType}, ${date.toISOString().split('T')[0]}, $${value.toLocaleString()}`);
        }
        processedRows++;

      } catch (error) {
        console.error(`Error procesando fila ${i + 1}:`, error);
        skippedRows++;
      }
    }

    console.log(`Procesamiento Siigo completado: ${processedRows} filas procesadas, ${skippedRows} filas saltadas`);

    // Verificar si se procesaron datos
    if (processedRows === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No se procesaron datos válidos de Siigo',
          details: 'Verifique que el archivo contenga datos con prefijos FC-, ND-, DS-, RP-',
          debug: {
            headers,
            sampleRows: dataRows.slice(0, 3)
          }
        },
        { status: 400 }
      );
    }

    // Mostrar resumen
    console.log('Resumen Siigo:');
    Object.entries(processedData).forEach(([type, data]) => {
      if (data.total > 0) {
        console.log(`${type}: $${data.total.toLocaleString()} total`);
      }
    });

    // Generar resumen por tipo de documento
    const summary = Object.entries(processedData).map(([type, data]) => ({
      type,
      name: documentTypeNames[type as DocumentType] || type,
      count: data.values.reduce((a, b) => a + b, 0),
      total: data.total,
      months: data.values.map((count, index) => ({
        month: index + 1,
        count,
        total: data.values[index] * (data.total / (data.values.reduce((a, b) => a + b, 1)) || 1)
      }))
    }));

    return NextResponse.json({
      success: true,
      message: `Procesados ${processedRows} registros de un total de ${dataRows.length}`,
      data: processedData,
      summary,
      stats: {
        totalProcessed: processedRows,
        totalSkipped: skippedRows,
        totalRows: dataRows.length,
        successRate: Math.round((processedRows / (processedRows + skippedRows)) * 100) || 0
      },
      headers: headers.map((h, i) => `${i}: ${h}`),
      sampleData: dataRows.slice(0, 3).map(row => ({
        factura: row[facturaIndex],
        fecha: row[fechaIndex],
        valor: row[valorIndex],
        proveedor: proveedorIndex !== -1 ? row[proveedorIndex] : 'N/A',
        identificacion: identificacionIndex !== -1 ? row[identificacionIndex] : 'N/A'
      }))
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error al procesar archivo Siigo:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al procesar el archivo Siigo',
        details: errorMessage,
        processedRows,
        skippedRows
      },
      { status: 500 }
    );
  }
}