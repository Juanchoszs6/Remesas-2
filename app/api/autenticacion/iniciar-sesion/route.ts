import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validations';
import { findUserByEmail, verifyPassword, createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar datos de entrada
    const validatedData = loginSchema.parse(body);
    
    // Buscar usuario
    const user = await findUserByEmail(validatedData.email);
    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }
    
    // Verificar contraseña
    const isValidPassword = await verifyPassword(validatedData.password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }
    
    // Crear sesión
    const sessionToken = await createSession(user.id);
    
    // Crear respuesta
    const response = NextResponse.json(
      { 
        message: 'Inicio de sesión exitoso',
        user: {
          id: user.id,
          email: user.email
        }
      },
      { status: 200 }
    );
    
    // Establecer cookie de sesión
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 días
      path: '/'
    });
    
    return response;
    
  } catch (error: unknown) {
    console.error('Error en inicio de sesión:', error);
    
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: (error as { errors: unknown }).errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
