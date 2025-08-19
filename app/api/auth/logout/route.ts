import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (sessionToken) {
      await deleteSession(sessionToken);
    }
    
    // Create response
    const response = NextResponse.json(
      { message: 'Sesión cerrada exitosamente' },
      { status: 200 }
    );
    
    // Clear session cookie
    response.cookies.delete('session_token');
    
    return response;
    
  } catch (error: any) {
    console.error('Logout error:', error);
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
