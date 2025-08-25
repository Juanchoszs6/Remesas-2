
export class SiigoAuthError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'SiigoAuthError';
  }
}

export async function obtenerTokenSiigo(): Promise<string> {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID || '';

  if (!username || !accessKey || !partnerId) {
    const errorMessage = '[SIIGO-AUTH] ❌ Credenciales faltantes';
    const missing = [
      !username && 'SIIGO_USERNAME',
      !accessKey && 'SIIGO_ACCESS_KEY',
      !partnerId && 'SIIGO_PARTNER_ID'
    ].filter(Boolean).join(', ');
    
    throw new SiigoAuthError(`${errorMessage}: ${missing}`);
  }

  const credentials = Buffer.from(`${username}:${accessKey}`).toString('base64');

  const authUrl = process.env.SIIGO_AUTH_URL || 'https://api.siigo.com/auth';
  
  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
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
    
    return responseData.access_token as string;
  } catch (error) {
    if (error instanceof SiigoAuthError) {
      console.error(`[SIIGO-AUTH] ❌ ${error.message}`);
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[SIIGO-AUTH] ❌ Error en la petición:', error);
    throw new SiigoAuthError(`Error en la petición: ${errorMessage}`, error);
  }
}
