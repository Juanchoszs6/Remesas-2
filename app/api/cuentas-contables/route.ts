import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Redirigir la petición al endpoint de gastos_cuentas_contables
    const url = new URL('/api/gastos_cuentas_contables', req.url);
    
    // Copiar todos los parámetros de consulta
    req.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
    
    // Realizar la petición al endpoint real
    const response = await fetch(url);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error en el proxy de cuentas contables:', error);
    return NextResponse.json(
      { error: 'Error al obtener las cuentas contables' },
      { status: 500 }
    );
  }
}
