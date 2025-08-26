import { NextResponse } from 'next/server';
import { SiigoAuthError } from '@/lib/siigo/auth';

/**
 * Interface para respuestas de error estandarizadas
 * @interface ErrorResponse
 * @property {string} error - Mensaje de error principal
 * @property {unknown} [details] - Detalles adicionales del error (opcional)
 * @property {number} status - Código de estado HTTP
 */
interface ErrorResponse {
  error: string;
  details?: unknown;
  status: number;
}

/**
 * Obtiene un token de autenticación de la API de Siigo con reintentos automáticos
 * @async
 * @function obtenerTokenSiigo
 * @returns {Promise<string>} Token de acceso de Siigo
 * @throws {SiigoAuthError} Cuando ocurre un error en la autenticación después de agotar los reintentos
 * @description
 * - Realiza hasta 3 intentos de autenticación con backoff exponencial
 * - Valida las credenciales de entorno requeridas
 * - Maneja errores de red y respuestas no exitosas
 */
export async function obtenerTokenSiigo(): Promise<string> {
  // Obtener credenciales de las variables de entorno con valores por defecto cuando corresponda
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

  // Configuración de reintentos con backoff exponencial
  const MAX_RETRIES = 3;
  const INITIAL_DELAY_MS = 1000; // 1 segundo
  const MAX_DELAY_MS = 10000;    // 10 segundos
  let lastError: Error | null = null;
  
  // Realizar hasta MAX_RETRIES intentos de autenticación
  for (let intento = 1; intento <= MAX_RETRIES; intento++) {
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
  
  // Este código es inalcanzable en condiciones normales, ya que el bucle lanza una excepción
  // en el último intento. Se mantiene como medida de seguridad.
  throw new SiigoAuthError('Error inesperado en la autenticación: Lógica de reintentos falló');
}

/**
 * Manejador de la ruta POST para autenticación con Siigo
 * @async
 * @function POST
 * @returns {Promise<NextResponse>} Respuesta JSON con el token o mensaje de error
 * @description
 * - Proporciona un endpoint para obtener un token de autenticación de Siigo
 * - Maneja errores y proporciona respuestas estandarizadas
 * - Usa el patrón de reintentos con backoff exponencial
 */
export async function POST() {
  try {
    const token = await obtenerTokenSiigo();
    return NextResponse.json({ token });
  } catch (error) {
    // Registrar el error con información estructurada para facilitar el diagnóstico
    console.error({
      message: 'Error en la autenticación con Siigo',
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
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
