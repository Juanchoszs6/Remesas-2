import { NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@/lib/validations';
import { createUser, findUserByEmail, createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar datos de entrada
    const validatedData = registerSchema.parse(body);
    
    // Verificar si el usuario ya existe
    const existingUser = await findUserByEmail(validatedData.email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'El usuario ya existe con este email' },
        { status: 400 }
      );
    }
    
    // Crear usuario
    const user = await createUser(validatedData.email, validatedData.password);
    
    // Crear sesión
    const sessionToken = await createSession(user.id);
    
    // Crear respuesta
    const response = NextResponse.json(
      { 
        message: 'Usuario registrado exitosamente',
        user: {
          id: user.id,
          email: user.email
        }
      },
      { status: 201 }
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
    console.error('Error en el registro:', error);
    
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
