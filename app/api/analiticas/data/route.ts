import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { QueryResult } from '@neondatabase/serverless';

// Funciones auxiliares para colores
const getBackgroundColor = (docType: string) => {
  const colors: Record<string, string> = {
    'FC': 'rgba(59, 130, 246, 0.5)',
    'ND': 'rgba(239, 68, 68, 0.5)',
    'DS': 'rgba(245, 158, 11, 0.5)',
    'RP': 'rgba(16, 185, 129, 0.5)'
  };
  return colors[docType] || 'rgba(156, 163, 175, 0.5)';
};

const getBorderColor = (docType: string) => {
  const colors: Record<string, string> = {
    'FC': 'rgb(59, 130, 246)',
    'ND': 'rgb(239, 68, 68)',
    'DS': 'rgb(245, 158, 11)',
    'RP': 'rgb(16, 185, 129)'
  };
  return colors[docType] || 'rgb(156, 163, 175)';
};

interface DatabaseRow {
  month: number;
  year: number;
  document_type: string;
  total_value: string | number;
}

interface MonthlyData {
  year: number;
  month: number;
  monthName: string;
  values: Record<string, number>;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  }>;
  months: string[];
  values: number[][];
}

export async function GET() {
  try {
    // Obtener datos agrupados por mes y tipo de documento
    const result = await sql`
      SELECT 
        month,
        year,
        document_type,
        SUM(total_value)::bigint as total_value
      FROM uploaded_files
      GROUP BY month, year, document_type
      ORDER BY year, month, document_type
    ` as unknown as QueryResult<DatabaseRow>;

    // Formatear los datos para el gráfico
    const monthlyData: Record<string, MonthlyData> = {};
    const documentTypes = new Set<string>();

    result.rows.forEach(row => {
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = {
          year: row.year,
          month: row.month,
          monthName: new Date(row.year, row.month - 1).toLocaleString('es-ES', { month: 'short' }),
          values: {}
        };
      }
      monthlyData[key].values[row.document_type] = Number(row.total_value);
      documentTypes.add(row.document_type);
    });

    // Convertir a array y ordenar por año y mes
    const sortedData = Object.values(monthlyData).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    // Obtener todos los tipos de documentos únicos
    const docTypes = Array.from(documentTypes);
    
    // Crear estructura de datos para el frontend
    const chartData: ChartData = {
      labels: sortedData.map(item => item.monthName),
      months: sortedData.map(item => item.monthName),
      // Un solo dataset con todos los tipos de documentos
      datasets: docTypes.map(docType => ({
        label: docType,
        data: sortedData.map(item => Number(item.values[docType] || 0)),
        backgroundColor: getBackgroundColor(docType),
        borderColor: getBorderColor(docType),
        borderWidth: 1
      })),
      // Mantener compatibilidad con el formato anterior
      values: docTypes.map(docType => 
        sortedData.map(item => Number(item.values[docType] || 0))
      )
    };
    
    return NextResponse.json({ success: true, data: chartData });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener los datos de análisis' },
      { status: 500 }
    );
  }
}
