import { NextResponse } from 'next/server';
import { SiigoAuthError } from '@/lib/siigo/auth';

interface ErrorResponse {
  error: string;
  details?: unknown;
  status: number;
}

export async function obtenerTokenSiigo(): Promise<string> {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes';
  const authUrl = process.env.SIIGO_AUTH_URL || 'https://api.siigo.com/auth';

  if (!username || !accessKey || !partnerId) {
    const missing = [
      !username && 'SIIGO_USERNAME',
      !accessKey && 'SIIGO_ACCESS_KEY',
      !partnerId && 'SIIGO_PARTNER_ID'
    ].filter(Boolean).join(', ');
    
    throw new SiigoAuthError(`Credenciales faltantes: ${missing}`);
  }

  // Intentar hasta 3 veces obtener un token válido
  let lastError: Error | null = null;
  
  for (let intento = 1; intento <= 3; intento++) {
    try {
      console.log(`[SIIGO-AUTH] Intento ${intento} de obtener token de Siigo`);
      console.log(`[SIIGO-AUTH] Intentando autenticar en: ${authUrl}`);
      
      const credentials = Buffer.from(`${username}:${accessKey}`).toString('base64');
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`,
          'Partner-Id': partnerId,
        },
        body: JSON.stringify({
          username,
          access_key: accessKey,
        }),
      });
      
      const responseData = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        const errorMessage = responseData.error_description || 
                            responseData.error || 
                            'Error desconocido';
        
        throw new SiigoAuthError(
          `Error en autenticación: ${errorMessage}`,
          { status: response.status, response: responseData }
        );
      }
      
      if (!responseData.access_token) {
        throw new SiigoAuthError('No se recibió token de acceso', responseData);
      }
      
      return responseData.access_token;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[SIIGO-AUTH] ❌ Error en el intento ${intento}:`, lastError);
      
      // Si es el último intento, lanzar el error
      if (intento === 3) {
        console.error('[SIIGO-AUTH] ❌ Se agotaron los intentos de autenticación');
        throw new SiigoAuthError(
          'Se agotaron los intentos de autenticación', 
          { cause: lastError }
        );
      }
      
      // Esperar antes de reintentar (backoff exponencial)
      const delay = Math.min(1000 * Math.pow(2, intento - 1), 10000);
      console.log(`[SIIGO-AUTH] Reintentando en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Este código no debería alcanzarse ya que el bucle lanza una excepción en el último intento
  throw new SiigoAuthError('Error inesperado en la autenticación');
}

export async function POST() {
  try {
    const token = await obtenerTokenSiigo();
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error en la autenticación con Siigo:', error);
    
    if (error instanceof SiigoAuthError) {
      return NextResponse.json(
        { 
          error: 'Error de autenticación con Siigo',
          details: error.message,
          status: 401
        } as ErrorResponse,
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
        status: 500
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
