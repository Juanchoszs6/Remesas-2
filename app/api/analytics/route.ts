import { NextResponse } from 'next/server';
import { obtenerAnalyticsSiigo } from '@/app/api/siigo/invoices/analytics';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // Verify user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get period from query params (default: 6m)
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '6m';
    
    // Validate period parameter
    if (!['today', '1m', '3m', '6m', '1y'].includes(period)) {
      return NextResponse.json(
        { error: 'Período no válido' },
        { status: 400 }
      );
    }

    // Get analytics data
    const analytics = await obtenerAnalyticsSiigo(period);
    
    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error en API de analytics:', error);
    return NextResponse.json(
      { error: 'Error al obtener los datos analíticos', details: error.message },
      { status: 500 }
    );
  }
}
