import { SiigoAuthResponse } from "../../../types/siigo";

const SIIGO_AUTH_URL = 'https://api.siigo.com/auth';
const SIIGO_CLIENT_ID = process.env.SIIGO_CLIENT_ID || '';
const SIIGO_CLIENT_SECRET = process.env.SIIGO_CLIENT_SECRET || '';

export async function obtenerTokenSiigo(): Promise<string> {
  try {
    const auth = Buffer.from(`${SIIGO_CLIENT_ID}:${SIIGO_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch(SIIGO_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error en autenticación Siigo: ${errorData.error || 'Error desconocido'}`);
    }

    const data: SiigoAuthResponse = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error al obtener token de Siigo:', error);
    throw new Error('No se pudo autenticar con Siigo. Por favor verifica las credenciales.');
  }
}
