import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    // Read the Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    // Función para normalizar texto de encabezado
    const normalizeHeader = (text: string): string => {
      if (!text) return '';
      return text.toString()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
        .trim();
    };

    // Encontrar la fila de encabezado
    let headerRowIndex = -1;
    let headers: string[] = [];
    let comprobanteIndex = -1;
    let fechaIndex = -1;
    let valorIndex = -1;

    // Buscar la fila que contenga los encabezados requeridos
    for (let i = 0; i < Math.min(10, jsonData.length); i++) { // Revisar solo las primeras 10 filas
      const row = jsonData[i] as any[];
      if (!Array.isArray(row)) continue;
      
      const normalizedRow = row.map(cell => normalizeHeader(cell));
      
      // Buscar índices de columnas requeridas
      comprobanteIndex = normalizedRow.findIndex(h => 
        h.includes('comprobante') || h.includes('documento')
      );
      
      fechaIndex = normalizedRow.findIndex(h => 
        h.includes('fecha') && (h.includes('elaboracion') || h.includes('emision') || h.includes('doc'))
      );
      
      valorIndex = normalizedRow.findIndex(h => 
        h.includes('valor') || h.includes('importe') || h.includes('monto')
      );
      
      // Si encontramos todas las columnas requeridas, esta es nuestra fila de encabezado
      if (comprobanteIndex !== -1 && fechaIndex !== -1 && valorIndex !== -1) {
        headerRowIndex = i;
        headers = normalizedRow;
        break;
      }
    }
    
    // Si no encontramos los encabezados, intentar con una estrategia más flexible
    if (headerRowIndex === -1) {
      // Buscar cualquier fila que tenga al menos 3 columnas con texto que parezcan encabezados
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i] as any[];
        if (!Array.isArray(row)) continue;
        
        const textColumns = row.filter(cell => 
          typeof cell === 'string' && cell.trim().length > 0
        );
        
        if (textColumns.length >= 3) {
          headerRowIndex = i;
          headers = row.map(cell => normalizeHeader(cell));
          
          // Intentar adivinar los índices
          comprobanteIndex = headers.findIndex(h => 
            h.includes('comprobante') || h.includes('documento') || h.includes('tipo')
          );
          
          fechaIndex = headers.findIndex(h => 
            h.includes('fecha') || h.includes('dia') || h.includes('mes')
          );
          
          valorIndex = headers.findIndex(h => 
            h.includes('valor') || h.includes('importe') || h.includes('monto') || h.includes('total')
          );
          
          // Si encontramos al menos 2 de 3 columnas, proceder
          const foundColumns = [comprobanteIndex, fechaIndex, valorIndex].filter(idx => idx !== -1).length;
          if (foundColumns >= 2) break;
        }
      }
    }
    
    // Si aún no encontramos los encabezados, devolver error con más información
    if (headerRowIndex === -1 || comprobanteIndex === -1 || fechaIndex === -1 || valorIndex === -1) {
      console.error('No se pudieron detectar los encabezados. Contenido del archivo:', jsonData.slice(0, 5));
      return NextResponse.json(
        { 
          error: 'No se pudo detectar la estructura del archivo',
          details: 'El archivo debe contener columnas para Comprobante, Fecha y Valor',
          sample: 'Por favor, asegúrese de que el archivo tenga encabezados como: "Tipo Documento", "Fecha", "Valor"'
        },
        { status: 400 }
      );
    }

    // Process data rows
    const processedData: Record<string, { values: number[], total: number }> = {
      FC: { values: Array(12).fill(0), total: 0 },
      ND: { values: Array(12).fill(0), total: 0 },
      DS: { values: Array(12).fill(0), total: 0 },
      RP: { values: Array(12).fill(0), total: 0 }
    };
    
    // Contador para depuración
    let processedRows = 0;
    let skippedRows = 0;
    
    // Procesar filas de datos
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      
      // Saltar filas vacías o sin datos relevantes
      if (!row || row.length === 0) {
        skippedRows++;
        continue;
      }
      
      // Obtener el tipo de documento (primero intentar por el índice, luego por búsqueda)
      let docType = '';
      const docTypeValue = row[comprobanteIndex] || '';
      
      if (typeof docTypeValue === 'string') {
        // Intentar extraer el tipo de documento (FC, ND, DS, RP)
        const match = docTypeValue.match(/^(FC|ND|DS|RP)[^a-z0-9]/i);
        docType = match ? match[1].toUpperCase() : '';
      }
      
      // Si no se pudo determinar el tipo de documento, intentar adivinarlo
      if (!docType) {
        const rowString = JSON.stringify(row).toLowerCase();
        if (rowString.includes('factura') || rowString.includes('fc')) docType = 'FC';
        else if (rowString.includes('nota debito') || rowString.includes('nd')) docType = 'ND';
        else if (rowString.includes('documento soporte') || rowString.includes('ds')) docType = 'DS';
        else if (rowString.includes('recibo pago') || rowString.includes('rp')) docType = 'RP';
      }
      
      if (!['FC', 'ND', 'DS', 'RP'].includes(docType)) {
        skippedRows++;
        continue;
      }
      
      // Procesar fecha (manejar diferentes formatos)
      let date: Date | null = null;
      const fechaValue = row[fechaIndex];
      
      // Intentar diferentes formatos de fecha
      if (fechaValue instanceof Date) {
        date = fechaValue;
      } else if (typeof fechaValue === 'number') {
        // Manejar números de fecha de Excel
        if (fechaValue > 40000) { // Números grandes probablemente sean fechas de Excel
          date = new Date((fechaValue - 25569) * 86400 * 1000);
        } else {
          // Podría ser un timestamp de Unix (segundos o milisegundos)
          date = new Date(fechaValue > 10000000000 ? fechaValue : fechaValue * 1000);
        }
      } else if (typeof fechaValue === 'string') {
        // Intentar diferentes formatos de fecha en string
        const dateFormats = [
          'YYYY-MM-DD',
          'DD/MM/YYYY',
          'MM/DD/YYYY',
          'YYYY/MM/DD',
          'DD-MM-YYYY',
          'MM-DD-YYYY'
        ];
        
        for (const format of dateFormats) {
          const parsedDate = new Date(fechaValue);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate;
            break;
          }
        }
      }
      
      if (!date || isNaN(date.getTime())) {
        console.warn(`Fila ${i + 1}: No se pudo interpretar la fecha:`, fechaValue);
        skippedRows++;
        continue;
      }
      
      // Obtener el mes (0-11)
      const month = date.getMonth();
      
      // Procesar el valor
      let value = 0;
      const valorValue = row[valorIndex];
      
      if (typeof valorValue === 'number') {
        value = valorValue;
      } else if (typeof valorValue === 'string') {
        // Limpiar el formato de moneda y convertir a número
        const cleanValue = valorValue
          .replace(/[^0-9,.-]/g, '') // Eliminar todo excepto números, punto y coma
          .replace(/\./g, '')         // Eliminar separadores de miles
          .replace(',', '.');          // Convertir coma decimal a punto
          
        value = parseFloat(cleanValue) || 0;
      }
      
      // Actualizar los datos procesados
      if (month >= 0 && month < 12) {
        processedData[docType as keyof typeof processedData].values[month] += value;
        processedData[docType as keyof typeof processedData].total += value;
        processedRows++;
      } else {
        console.warn(`Fila ${i + 1}: Mes inválido:`, month);
        skippedRows++;
      }
    }

    // Datos de depuración para el registro
    console.log('Procesamiento completado:', {
      processedRows,
      skippedRows,
      processedData
    });

    // Verificar si se procesaron filas
    if (processedRows === 0) {
      console.warn('No se procesaron filas. Datos de muestra:', jsonData.slice(0, 5));
      return NextResponse.json(
        { 
          success: false,
          error: 'No se encontraron datos válidos para procesar',
          details: 'El archivo no contiene datos que coincidan con el formato esperado',
          sampleData: jsonData.slice(0, 5) // Mostrar primeras filas para depuración
        },
        { status: 400 }
      );
    }

    // Devolver los datos procesados
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
          headerRowIndex
        }
      }
    });

  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { error: 'Error al procesar el archivo' },
      { status: 500 }
    );
  }
}
