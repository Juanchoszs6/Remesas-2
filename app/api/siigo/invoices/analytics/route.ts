import { NextRequest, NextResponse } from 'next/server';
import { obtenerAnalyticsSiigo } from '../analytics';

// Ruta GET para obtener analytics de facturas
export async function GET(request: NextRequest) {
  try {
    // Obtener el periodo desde los parámetros de consulta
    const searchParams = request.nextUrl.searchParams;
    const periodo = searchParams.get('periodo') || '6m';
    
    // Validar que el periodo sea válido
    if (!['today', '1m', '3m', '6m', '1y'].includes(periodo)) {
      return NextResponse.json(
        { error: 'Periodo inválido. Valores permitidos: today, 1m, 3m, 6m, 1y' },
        { status: 400 }
      );
    }
    
    // Obtener analytics desde Siigo
    const analytics = await obtenerAnalyticsSiigo(periodo);
    
    // Devolver los datos
    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error en la ruta de analytics de facturas:', error);
    
    return NextResponse.json(
      { error: `Error al obtener analytics: ${error.message}` },
      { status: 500 }
    );
  }
}