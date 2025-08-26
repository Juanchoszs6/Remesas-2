import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (sessionToken) {
      await deleteSession(sessionToken);
    }
    
    // Crear respuesta
    const response = NextResponse.json(
      { message: 'Sesión cerrada exitosamente' },
      { status: 200 }
    );
    
    // Eliminar cookie de sesión
    response.cookies.delete('session_token');
    
    return response;
    
  } catch (error: unknown) {
    console.error('Error al cerrar sesión:', error);
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
