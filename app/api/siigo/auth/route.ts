import { NextResponse } from 'next/server';

export async function obtenerTokenSiigo(): Promise<string | null> {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes';
  const authUrl = process.env.SIIGO_AUTH_URL || 'https://api.siigo.com/auth';

  if (!username || !accessKey || !partnerId) {
    console.error('[SIIGO-AUTH] ❌ Credenciales faltantes en variables de entorno');
    console.log('[SIIGO-AUTH] Variables disponibles:', { 
      username: username ? '✅' : '❌',
      accessKey: accessKey ? '✅' : '❌',
      partnerId: partnerId ? '✅' : '❌',
      authUrl: authUrl ? '✅' : '❌'
    });
    return null;
  }

  // Intentar hasta 3 veces obtener un token válido
  for (let intento = 1; intento <= 3; intento++) {
    try {
      console.log(`[SIIGO-AUTH] Intento ${intento} de obtener token de Siigo`);
      
      console.log(`[SIIGO-AUTH] Intentando autenticar en: ${authUrl}`);
      
      const requestBody = {
        username,
        access_key: accessKey,
      };

      console.log('[SIIGO-AUTH] Cuerpo de la solicitud:', JSON.stringify(requestBody));
      
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Partner-Id': partnerId,
        },
        body: JSON.stringify(requestBody),
        cache: 'no-store',
      });

      console.log(`[SIIGO-AUTH] Estado de la respuesta: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch (e) {
          errorDetails = await response.text();
        }
        
        console.error(`[SIIGO-AUTH] ❌ Error en autenticación (intento ${intento}):`);
        console.error(`- Status: ${response.status} ${response.statusText}`);
        console.error(`- Detalles:`, errorDetails);
        
        // Si es el último intento, retornar null
        if (intento === 3) {
          return null;
        }
        
        // Esperar antes de reintentar (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, 1000 * intento));
        continue;
      }

      const data = await response.json();
      const token = data.access_token;
      
      if (!token) {
        console.error(`[SIIGO-AUTH] ❌ No se recibió token en la respuesta (intento ${intento})`);
        
        // Si es el último intento, retornar null
        if (intento === 3) {
          return null;
        }
        
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 1000 * intento));
        continue;
      }
      
      console.log(`[SIIGO-AUTH] ✅ Token obtenido exitosamente en el intento ${intento}`);
      return token;
    } catch (error) {
      console.error(`[SIIGO-AUTH] 💥 Error al obtener token (intento ${intento}):`, error);
      
      // Si es el último intento, retornar null
      if (intento === 3) {
        return null;
      }
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 1000 * intento));
    }
  }
  
  return null;
}

export async function POST() {
  const token = await obtenerTokenSiigo();
  
  if (!token) {
    return NextResponse.json(
      { error: 'No se pudo obtener el token de autenticación' },
      { status: 500 }
    );
  }

  return NextResponse.json({ access_token: token });
}
