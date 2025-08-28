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
    // Obtener datos de la base de datos para el año 2025
    const result = await sql`
      WITH meses AS (
        SELECT generate_series(1, 12) as mes
      ),
      documentos_por_mes AS (
        SELECT 
          uf.month as mes,
          uf.document_type as tipo_documento,
          SUM(uf.total_value) as valor_total,
          COUNT(uf.id) as cantidad
        FROM uploaded_files uf
        WHERE uf.year = 2025
        GROUP BY uf.month, uf.document_type
      )
      SELECT 
        m.mes,
        2025 as año,
        dt.tipo as tipo_documento,
        COALESCE(SUM(d.valor_total)::float, 0) as valor_total,
        COALESCE(SUM(d.cantidad)::integer, 0) as cantidad
      FROM meses m
      CROSS JOIN (SELECT unnest(ARRAY['FC', 'RP', 'ND', 'DS']) as tipo) dt
      LEFT JOIN documentos_por_mes d ON 
        m.mes = d.mes AND
        dt.tipo = d.tipo_documento
      GROUP BY m.mes, dt.tipo
      ORDER BY m.mes, dt.tipo
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
