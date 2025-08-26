import { NextResponse } from 'next/server';
import { obtenerAnalyticsSiigo } from '@/app/api/siigo/facturas/analiticas';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // Verificar que el usuario esté autenticado
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener el período de los parámetros de consulta (predeterminado: 6m)
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '6m';
    
    // Validar el parámetro de período
    if (!['today', '1m', '3m', '6m', '1y'].includes(period)) {
      return NextResponse.json(
        { error: 'Período no válido' },
        { status: 400 }
      );
    }

    // Obtener datos analíticos
    const analytics = await obtenerAnalyticsSiigo(period);
    
    return NextResponse.json(analytics);
  } catch (error: unknown) {
    console.error('Error en la API de analíticas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al obtener los datos analíticos', details: errorMessage },
      { status: 500 }
    );
  }
}
