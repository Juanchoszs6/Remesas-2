import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No se han proporcionado archivos' },
        { status: 400 }
      );
    }

    // Asegurarse de que el directorio de subidas exista
    const uploadDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const results = [];
    
    for (const file of files) {
      try {
        // Leer el archivo como ArrayBuffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Procesar archivo Excel
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Extraer fecha de la primera fila (asumiendo que la primera columna contiene fechas)
        let fileDate = new Date();
        if (jsonData.length > 0) {
          const firstRow = jsonData[0] as Record<string, unknown>;
          const dateValue = Object.values(firstRow)[0];
          
          if (dateValue) {
            try {
              // Manejar números de fecha de Excel (fechas seriales)
              if (typeof dateValue === 'number') {
                // Convertir número de fecha de Excel a fecha de JavaScript
                const excelEpoch = new Date(1899, 11, 30);
                const jsDate = new Date(excelEpoch.getTime() + (dateValue * 24 * 60 * 60 * 1000));
                if (!isNaN(jsDate.getTime())) {
                  fileDate = jsDate;
                }
              } else {
                const dateString = String(dateValue);
                const parsedDate = new Date(dateString);
                if (!isNaN(parsedDate.getTime())) {
                  fileDate = parsedDate;
                }
              }
            } catch (e) {
              console.warn('Error parsing date:', e);
              // Usar la fecha actual si falla el análisis
            }
          }
        }

        // Determinar el tipo de documento a partir del nombre del archivo
        const prefix = file.name.substring(0, 2).toUpperCase();
        const validTypes = ['FC', 'RP', 'DS', 'ND'];
        const type = validTypes.includes(prefix) ? prefix : 'UNKNOWN';
        
        // Guardar archivo con marca de tiempo
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const newFilename = `${type}_${fileDate.getFullYear()}_${String(fileDate.getMonth() + 1).padStart(2, '0')}_${timestamp}.${fileExtension}`;
        const filePath = join(uploadDir, newFilename);
        
        await writeFile(filePath, buffer);
        
        results.push({
          originalName: file.name,
          savedName: newFilename,
          type,
          month: fileDate.getMonth() + 1,
          year: fileDate.getFullYear(),
          size: file.size,
          status: 'success'
        });
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        results.push({
          originalName: file.name,
          error: 'Error al procesar el archivo',
          status: 'error'
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Archivos procesados correctamente',
      results 
    });
    
  } catch (error) {
    console.error('Error in upload API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar los archivos' },
      { status: 500 }
    );
  }
}
