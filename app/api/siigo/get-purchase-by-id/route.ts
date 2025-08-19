import { NextResponse } from 'next/server';

// Types for SIIGO API
interface SiigoTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface SiigoError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// Debug configuration
const DEBUG = process.env.NODE_ENV === 'development';
const SIIGO_API_URL = process.env.SIIGO_API_URL || 'https://api.siigo.com/v1';

/**
 * Log debug information in development mode
 */
function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[SIIGO-PURCHASE-BY-ID-API] ${timestamp}: ${message}`);
    if (data !== undefined) {
      console.log(`[SIIGO-PURCHASE-BY-ID-API] Data:`, JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Log error information
 */
function debugError(message: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  console.error(`[SIIGO-PURCHASE-BY-ID-API] ERROR ${timestamp}: ${message}`);
  
  if (error instanceof Error) {
    console.error(`[SIIGO-PURCHASE-BY-ID-API] ${error.name}: ${error.message}`);
    if (error.stack) {
      console.error(`[SIIGO-PURCHASE-BY-ID-API] Stack: ${error.stack}`);
    }
  } else if (error !== undefined) {
    console.error('[SIIGO-PURCHASE-BY-ID-API] Error details:', JSON.stringify(error, null, 2));
  }
}

/**
 * Get authentication token from SIIGO API
 */
async function getSiigoToken(): Promise<string | null> {
  const functionName = 'getSiigoToken';
  debugLog(`${functionName}: Iniciando autenticación con SIIGO`);
  
  try {
    const authUrl = `${SIIGO_API_URL}/auth`;
    const authData = {
      username: process.env.SIIGO_USERNAME,
      access_key: process.env.SIIGO_ACCESS_KEY
    };

    debugLog(`${functionName}: Enviando solicitud a ${authUrl}`);
    
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
      },
      body: JSON.stringify(authData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      debugError(`${functionName}: Error en la respuesta de autenticación`, {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      return null;
    }

    const data: SiigoTokenResponse = await response.json();
    debugLog(`${functionName}: Autenticación exitosa`);
    return data.access_token;
  } catch (error) {
    debugError(`${functionName}: Error en la solicitud de autenticación`, error);
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  debugLog('Solicitud de búsqueda de factura por ID recibida', { id });

  if (!id) {
    debugError('ID de factura no proporcionado', null);
    return NextResponse.json(
      { error: 'Se requiere el ID de la factura' },
      { status: 400 }
    );
  }

  try {
    // Obtener el token de autenticación
    const token = await getSiigoToken();
    if (!token) {
      debugError('No se pudo obtener el token de autenticación', null);
      return NextResponse.json(
        { error: 'Error de autenticación con Siigo' },
        { status: 401 }
      );
    }

    const siigoApiUrl = `${SIIGO_API_URL}/purchases/${id}`;
    debugLog(`Buscando factura en Siigo API`, { url: siigoApiUrl });

    const response = await fetch(siigoApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      debugError('Error en la respuesta de Siigo API', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Factura no encontrada', details: errorData },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Error al buscar la factura',
          details: errorData
        },
        { status: response.status }
      );
    }
    
    const invoiceData = await response.json();
    debugLog('Factura encontrada exitosamente', { id });
    
    return NextResponse.json(invoiceData);
    
  } catch (error) {
    debugError('Error en el servidor al buscar la factura', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
