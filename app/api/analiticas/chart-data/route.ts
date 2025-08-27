import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType') || 'FC';
    const timeRange = searchParams.get('timeRange') || 'month';
    const userId = 1; // TODO: Get from session/token

    // Get current date values for filtering
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-based
    const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;

    // Execute the query with parameters using template literals
    const result = await sql`
      WITH meses AS (
        SELECT 
          EXTRACT(MONTH FROM uploaded_at)::integer as mes,
          EXTRACT(YEAR FROM uploaded_at)::integer as anio,
          SUM(total_value) as valor_total,
          SUM(processed_rows) as filas_procesadas
        FROM 
          uploaded_files
        WHERE 
          user_id = ${userId}
          AND document_type = ${documentType}
          ${sql.unsafe(timeRange === 'day' ? "AND uploaded_at >= CURRENT_DATE - INTERVAL '30 days'" : '')}
          ${sql.unsafe(timeRange === 'week' ? "AND uploaded_at >= CURRENT_DATE - INTERVAL '12 weeks'" : '')}
          ${sql.unsafe(timeRange === 'month' ? `AND (year = ${currentYear} OR (year = ${currentYear - 1} AND month > ${currentMonth}))` : '')}
          ${sql.unsafe(timeRange === 'quarter' ? `AND ((year = ${currentYear} AND month >= ${(currentQuarter - 1) * 3 + 1}) OR (year = ${currentYear - 1} AND month > ${(currentQuarter - 1) * 3 + 1}))` : '')}
          ${sql.unsafe(timeRange === 'year' ? `AND year >= ${currentYear - 4}` : '')}
          ${sql.unsafe(!['day', 'week', 'month', 'quarter', 'year'].includes(timeRange) ? `AND (year = ${currentYear} OR (year = ${currentYear - 1} AND month > ${currentMonth}))` : '')}
        GROUP BY 
          EXTRACT(YEAR FROM uploaded_at),
          EXTRACT(MONTH FROM uploaded_at)
      )
      SELECT 
        mes as month,
        anio as year,
        valor_total as total_value,
        filas_procesadas as processed_rows
      FROM 
        meses
      ORDER BY 
        anio ASC, mes ASC
    ` as unknown as { rows: ChartDataRow[] };

    interface ChartDataRow {
      month: number | string;
      year: number | string;
      total_value: string | number;
      processed_rows: number;
    }


    // Format data for the chart
    const labels: string[] = [];
    const values: number[] = [];
    
    result.rows.forEach((row: ChartDataRow) => {
      const monthNumber = typeof row.month === 'string' ? parseInt(row.month, 10) : row.month;
      const year = typeof row.year === 'string' ? parseInt(row.year, 10) : row.year;
      
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthIndex = Number.isInteger(monthNumber) ? Math.max(0, Math.min(11, monthNumber - 1)) : 0;
      const monthName = monthNames[monthIndex] || '';
      
      const totalValue = typeof row.total_value === 'string' 
        ? parseFloat(row.total_value) 
        : Number(row.total_value);
      
      labels.push(`${monthName} ${year}`);
      values.push(Number.isFinite(totalValue) ? totalValue : 0);
    });

    return NextResponse.json({
      success: true,
      data: {
        labels,
        values,
        total: values.reduce((sum, val) => sum + val, 0).toFixed(2),
        count: values.length,
        documentType,
        timeRange
      }
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { success: false, error: 'Error al cargar los datos del gráfico' },
      { status: 500 }
    );
  }
}
