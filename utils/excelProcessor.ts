import * as XLSX from 'xlsx';

export interface SiigoRecord {
  factura: string;
  fecha: Date;
  identificacion: string;
  proveedor: string;
  valor: number;
  moneda: string;
  tipo: 'FC' | 'ND' | 'DS' | 'RP';
  mes: number;
  año: number;
}

export interface ProcessedSiigoData {
  records: SiigoRecord[];
  summary: {
    FC: { total: number; byMonth: number[] };
    ND: { total: number; byMonth: number[] };
    DS: { total: number; byMonth: number[] };
    RP: { total: number; byMonth: number[] };
  };
  metadata: {
    totalRecords: number;
    processedRecords: number;
    skippedRecords: number;
    dateRange: { start: Date; end: Date } | null;
  };
}

// Función para normalizar texto
const normalizeText = (text: string): string => {
  return text.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
};

// Función para detectar tipo de documento desde el comprobante
const detectDocumentType = (comprobante: string): 'FC' | 'ND' | 'DS' | 'RP' | null => {
  if (!comprobante) return null;
  
  const comp = comprobante.toUpperCase().trim();
  
  if (comp.startsWith('FC-') || comp.includes('FC-')) return 'FC';
  if (comp.startsWith('ND-') || comp.includes('ND-')) return 'ND';
  if (comp.startsWith('DS-') || comp.includes('DS-')) return 'DS';
  if (comp.startsWith('RP-') || comp.includes('RP-')) return 'RP';
  
  return null;
};

// Función para parsear fechas en formato DD/MM/YYYY
const parseSiigoDate = (dateValue: string | number | boolean | Date | null | undefined): Date | null => {
  if (!dateValue) return null;
  
  try {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (typeof dateValue === 'number') {
      // Fecha de Excel
      return new Date((dateValue - 25569) * 86400 * 1000);
    }
    
    if (typeof dateValue === 'string') {
      const dateStr = dateValue.trim();
      const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      
      if (match) {
        const [, day, month, year] = match;
        let yearNum = parseInt(year);
        
        if (yearNum < 100) {
          yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
        }
        
        const date = new Date(yearNum, parseInt(month) - 1, parseInt(day));
        
        if (!isNaN(date.getTime()) && yearNum >= 2020 && yearNum <= 2030) {
          return date;
        }
      }
    }
  } catch (error) {
    console.error('Error parsing date:', error);
  }
  
  return null;
};

// Función para parsear valores monetarios
const parseValue = (valueInput: string | number | boolean | Date): number => {
  if (typeof valueInput === 'number') {
    return Math.abs(valueInput);
  }
  
  if (typeof valueInput === 'string') {
    let cleanValue = valueInput
      .replace(/[$€£¥₹₽COP\s]/g, '')
      .trim();
    
    // Formato colombiano: 1.234.567,89
    if (/\d+\.\d{3},\d{2}$/.test(cleanValue)) {
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    }
    // Formato americano: 1,234,567.89
    else if (/\d+,\d{3}\.\d{2}$/.test(cleanValue)) {
      cleanValue = cleanValue.replace(/,/g, '');
    }
    // Solo coma decimal: 1234,56
    else if (/^\d+,\d{2}$/.test(cleanValue)) {
      cleanValue = cleanValue.replace(',', '.');
    }
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }
  
  return 0;
};

// Función principal para procesar archivo Excel de Siigo
export async function processExcelToJson(file: File): Promise<ProcessedSiigoData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'buffer',
    cellDates: true,
    cellText: false
  });
  
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convertir a array de arrays
  const jsonData = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date>>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false
  });
  
  if (jsonData.length === 0) {
    throw new Error('El archivo está vacío');
  }
  
  // Buscar fila de encabezados
  let headerRowIndex = -1;
  let headers: string[] = [];
  
  const requiredHeaders = ['factura proveedor', 'fecha elaboracion', 'valor'];
  
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    const row = (jsonData[i] as Array<string | number | boolean | Date>) || [];
    const normalizedRow = row.map(cell => {
      // Handle boolean values explicitly to avoid 'false' being converted to 'false' string
      const value = cell === true ? 'true' : cell === false ? 'false' : String(cell || '');
      return normalizeText(value);
    });
    
    const hasRequiredHeaders = requiredHeaders.every(required => 
      normalizedRow.some(header => header.includes(required))
    );
    
    if (hasRequiredHeaders) {
      headerRowIndex = i;
      headers = normalizedRow;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error('No se encontraron los encabezados requeridos de Siigo');
  }
  
  // Encontrar índices de columnas
  const facturaIndex = headers.findIndex(h => h.includes('factura') && h.includes('proveedor'));
  const fechaIndex = headers.findIndex(h => h.includes('fecha') && h.includes('elaboracion'));
  const valorIndex = headers.findIndex(h => h === 'valor');
  const proveedorIndex = headers.findIndex(h => h === 'proveedor');
  const identificacionIndex = headers.findIndex(h => h === 'identificacion');
  const monedaIndex = headers.findIndex(h => h === 'moneda');
  
  if (facturaIndex === -1 || fechaIndex === -1 || valorIndex === -1) {
    throw new Error('Columnas requeridas no encontradas');
  }
  
  // Procesar filas de datos
  const dataRows = jsonData.slice(headerRowIndex + 1);
  const records: SiigoRecord[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  
  // Inicializar resumen
  const summary = {
    FC: { total: 0, byMonth: Array(12).fill(0) },
    ND: { total: 0, byMonth: Array(12).fill(0) },
    DS: { total: 0, byMonth: Array(12).fill(0) },
    RP: { total: 0, byMonth: Array(12).fill(0) }
  };
  
  let dateRange: { start: Date; end: Date } | null = null;
  
  for (const row of dataRows) {
    if (!row || row.length < 3) {
      skippedCount++;
      continue;
    }
    
    try {
      // Extraer datos
      const factura = String(row[facturaIndex] ?? '').trim();
      const fechaValue = row[fechaIndex];
      const fecha = fechaValue instanceof Date ? fechaValue : parseSiigoDate(String(fechaValue ?? ''));
      const valorValue = row[valorIndex];
      const valor = typeof valorValue === 'number' ? valorValue : parseValue(String(valorValue ?? '0'));
      const proveedor = String(row[proveedorIndex] ?? '').trim();
      const identificacion = String(row[identificacionIndex] ?? '').trim();
      const moneda = String(row[monedaIndex] ?? 'COP').trim();
      
      // Validaciones
      if (!factura || !fecha || valor <= 0) {
        skippedCount++;
        continue;
      }
      
      const tipo = detectDocumentType(factura);
      if (!tipo) {
        skippedCount++;
        continue;
      }
      
      const mes = fecha.getMonth();
      const año = fecha.getFullYear();
      
      // Crear registro
      const record: SiigoRecord = {
        factura,
        fecha,
        identificacion,
        proveedor,
        valor,
        moneda,
        tipo,
        mes,
        año
      };
      
      records.push(record);
      processedCount++;
      
      // Actualizar resumen
      summary[tipo].total += valor;
      summary[tipo].byMonth[mes] += valor;
      
      // Actualizar rango de fechas
      if (!dateRange) {
        dateRange = { start: fecha, end: fecha };
      } else {
        if (fecha < dateRange.start) dateRange.start = fecha;
        if (fecha > dateRange.end) dateRange.end = fecha;
      }
      
    } catch (error) {
      console.error('Error procesando fila:', error);
      skippedCount++;
    }
  }
  
  return {
    records,
    summary,
    metadata: {
      totalRecords: dataRows.length,
      processedRecords: processedCount,
      skippedRecords: skippedCount,
      dateRange
    }
  };
}

// Función para exportar a JSON
export function exportToJson(data: ProcessedSiigoData): string {
  return JSON.stringify(data, null, 2);
}

// Función para agrupar por mes y tipo
export function groupByMonthAndType(records: SiigoRecord[]) {
  const grouped: Record<string, Record<number, SiigoRecord[]>> = {
    FC: {},
    ND: {},
    DS: {},
    RP: {}
  };
  
  for (const record of records) {
    if (!grouped[record.tipo][record.mes]) {
      grouped[record.tipo][record.mes] = [];
    }
    grouped[record.tipo][record.mes].push(record);
  }
  
  return grouped;
}

// Función para obtener estadísticas detalladas
export function getDetailedStats(records: SiigoRecord[]) {
  const stats = {
    byType: { FC: 0, ND: 0, DS: 0, RP: 0 },
    byMonth: Array(12).fill(0),
    byProvider: new Map<string, number>(),
    totalValue: 0,
    recordCount: records.length
  };
  
  for (const record of records) {
    stats.byType[record.tipo] += record.valor;
    stats.byMonth[record.mes] += record.valor;
    stats.totalValue += record.valor;
    
    const currentProviderValue = stats.byProvider.get(record.proveedor) || 0;
    stats.byProvider.set(record.proveedor, currentProviderValue + record.valor);
  }
  
  return stats;
}   