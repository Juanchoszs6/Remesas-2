import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Definir tipos para los datos de la base de datos
interface FilaBaseDatos {
  mes: number;
  año: number;
  tipo_documento: string;
  valor_total: number;
  cantidad: number;
}

interface DatosGrafico {
  etiquetas: string[];
  conjuntosDatos: Array<{
    etiqueta: string;
    datos: number[];
    total: number;
  }>;
  tiposDocumento: string[];
  total: number;
}

// Tipo para el resultado de la consulta SQL
type ResultadoConsulta = FilaBaseDatos[];

export async function GET() {
  try {
    // Obtener datos de la base de datos para el año actual (2025)
    const result = await sql`
      WITH meses_anio AS (
        SELECT 
          generate_series(
            date_trunc('year', NOW()),
            date_trunc('year', NOW()) + INTERVAL '1 year' - INTERVAL '1 day',
            INTERVAL '1 month'
          ) as fecha
      )
      SELECT 
        EXTRACT(MONTH FROM m.fecha)::integer as mes,
        EXTRACT(YEAR FROM m.fecha)::integer as año,
        dt.tipo as tipo_documento,
        COALESCE(SUM(uf.total_value)::float, 0) as valor_total,
        COUNT(uf.id) as cantidad
      FROM meses_anio m
      CROSS JOIN (SELECT unnest(ARRAY['FC', 'RP', 'ND', 'DS']) as tipo) dt
      LEFT JOIN uploaded_files uf ON 
        EXTRACT(MONTH FROM uf.uploaded_at) = EXTRACT(MONTH FROM m.fecha) AND
        EXTRACT(YEAR FROM uf.uploaded_at) = EXTRACT(YEAR FROM m.fecha) AND
        uf.document_type = dt.tipo
      GROUP BY m.fecha, dt.tipo, mes, año
      ORDER BY año, mes, dt.tipo
    ` as unknown as ResultadoConsulta;

    // Crear array para el año 2025 (de enero a diciembre)
    const añoActual = 2025;
    const meses = Array.from({ length: 12 }, (_, i) => {
      const fecha = new Date(añoActual, i, 1);
      return {
        mes: i + 1,
        año: añoActual,
        nombre: fecha.toLocaleString('es-ES', { month: 'short' })
      };
    });

    // Procesar los datos para el gráfico
    const filas: FilaBaseDatos[] = Array.isArray(result) ? result : [];
    
    // Obtener todos los tipos de documentos únicos
    const tiposDocumento = ['FC', 'RP', 'ND', 'DS'];
    
    // Crear etiquetas para el eje X (solo el nombre del mes)
    const etiquetas = meses.map(m => m.nombre);
    
    // Crear conjuntos de datos para cada tipo de documento
    const conjuntosDatos = tiposDocumento
      .filter(tipoDoc => 
        filas.some(fila => fila.tipo_documento === tipoDoc && fila.valor_total > 0)
      )
      .map((tipoDoc) => {
        const datos = meses.map((mes) => {
          const fila = filas.find(
            (r) => r.mes === mes.mes && 
                   r.año === mes.año && 
                   r.tipo_documento === tipoDoc
          );
          return fila ? Number(fila.valor_total) : 0;
        });
        
        // Calcular el total para este tipo de documento
        const total = datos.reduce((suma, valor) => suma + valor, 0);
        
        // Solo incluir tipos de documento con datos
        return total > 0 ? {
          etiqueta: tipoDoc,
          datos,
          total
        } : null;
      })
      .filter(Boolean) as Array<{ etiqueta: string; datos: number[]; total: number }>;

    return NextResponse.json({
      exito: true,
      datos: {
        etiquetas,
        conjuntosDatos,
        tiposDocumento: Array.from(new Set(conjuntosDatos.map(d => d.etiqueta))),
        total: conjuntosDatos.reduce((suma, conjunto) => suma + conjunto.total, 0)
      }
    });

  } catch (error) {
    console.error('Error al obtener datos analíticos:', error);
    return NextResponse.json(
      { exito: false, error: 'Error al obtener los datos de análisis' },
      { status: 500 }
    );
  }
}
