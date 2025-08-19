import { NextRequest, NextResponse } from 'next/server';
import { obtenerTokenSiigo } from '../siigoAuth';

// Configuración de debugging
const DEBUG = true;

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    console.log(`[SIIGO-TEST] ${new Date().toISOString()}: ${message}`);
    if (data) {
      console.log('[SIIGO-TEST] Data:', JSON.stringify(data, null, 2));
    }
  }
}

function debugError(message: string, error: unknown): void {
  console.error(`[SIIGO-TEST] ERROR ${new Date().toISOString()}: ${message}`);
  console.error('[SIIGO-TEST] Error details:', error);
}

// Función para probar la conexión básica con Siigo
async function probarConexionSiigo(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
  details?: unknown;
}> {
  debugLog('=== INICIANDO PRUEBA DE CONEXIÓN CON SIIGO ===');
  
  try {
    // Paso 1: Obtener token de autenticación
    debugLog('Paso 1: Obteniendo token de autenticación usando obtenerTokenSiigo()');
    const token = await obtenerTokenSiigo();
    
    if (!token) {
      debugError('No se pudo obtener el token de autenticación', null);
      return {
        success: false,
        error: 'No se pudo obtener el token de autenticación de Siigo'
      };
    }
    
    debugLog('Token obtenido exitosamente', { 
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...'
    });
    
    return {
      success: true,
      token: token.substring(0, 20) + '...' // Solo mostrar parte del token por seguridad
    };
    
  } catch (error) {
    debugError('Error en prueba de conexión', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      details: error
    };
  }
}

// Función para probar endpoints básicos de Siigo
async function probarEndpointsSiigo(token: string): Promise<{
  success: boolean;
  tests: Array<{
    endpoint: string;
    status: number;
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
}> {
  debugLog('=== INICIANDO PRUEBAS DE ENDPOINTS DE SIIGO ===');
  
  const tests = [];
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes'
  };
  
  // Test 1: Consultar tipos de documento
  try {
    debugLog('Test 1: Consultando tipos de documento');
    const response1 = await fetch('https://api.siigo.com/v1/document-types?type=FV', {
      method: 'GET',
      headers: baseHeaders
    });
    
    const data1 = await response1.json();
    debugLog(`Respuesta tipos de documento: Status ${response1.status}`, data1);
    
    tests.push({
      endpoint: '/v1/document-types?type=FV',
      status: response1.status,
      success: response1.ok,
      data: response1.ok ? data1 : undefined,
      error: response1.ok ? undefined : JSON.stringify(data1)
    });
  } catch (error) {
    debugError('Error en test de tipos de documento', error);
    tests.push({
      endpoint: '/v1/document-types?type=FV',
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
  
  // Test 2: Consultar métodos de pago
  try {
    debugLog('Test 2: Consultando métodos de pago');
    const response2 = await fetch('https://api.siigo.com/v1/payment-types?document_type=FV', {
      method: 'GET',
      headers: baseHeaders
    });
    
    const data2 = await response2.json();
    debugLog(`Respuesta métodos de pago: Status ${response2.status}`, data2);
    
    tests.push({
      endpoint: '/v1/payment-types?document_type=FV',
      status: response2.status,
      success: response2.ok,
      data: response2.ok ? data2 : undefined,
      error: response2.ok ? undefined : JSON.stringify(data2)
    });
  } catch (error) {
    debugError('Error en test de métodos de pago', error);
    tests.push({
      endpoint: '/v1/payment-types?document_type=FV',
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
  
  // Test 3: Consultar impuestos
  try {
    debugLog('Test 3: Consultando impuestos');
    const response3 = await fetch('https://api.siigo.com/v1/taxes', {
      method: 'GET',
      headers: baseHeaders
    });
    
    const data3 = await response3.json();
    debugLog(`Respuesta impuestos: Status ${response3.status}`, data3);
    
    tests.push({
      endpoint: '/v1/taxes',
      status: response3.status,
      success: response3.ok,
      data: response3.ok ? data3 : undefined,
      error: response3.ok ? undefined : JSON.stringify(data3)
    });
  } catch (error) {
    debugError('Error en test de impuestos', error);
    tests.push({
      endpoint: '/v1/taxes',
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
  
  const successfulTests = tests.filter(test => test.success).length;
  debugLog(`=== PRUEBAS COMPLETADAS: ${successfulTests}/${tests.length} exitosas ===`);
  
  return {
    success: successfulTests > 0,
    tests
  };
}

// Handler principal del endpoint de prueba
export async function GET(request: NextRequest): Promise<NextResponse> {
  debugLog('=== NUEVA PETICIÓN DE PRUEBA RECIBIDA ===');
  
  try {
    // Paso 1: Probar conexión básica
    const conexionResult = await probarConexionSiigo();
    
    if (!conexionResult.success) {
      return NextResponse.json({
        success: false,
        message: 'Error en la conexión con Siigo',
        error: conexionResult.error,
        details: conexionResult.details
      }, { status: 500 });
    }
    
    // Paso 2: Obtener token completo para las pruebas
    const tokenCompleto = await obtenerTokenSiigo();
    if (!tokenCompleto) {
      return NextResponse.json({
        success: false,
        message: 'No se pudo obtener token para las pruebas'
      }, { status: 500 });
    }
    
    // Paso 3: Probar endpoints básicos
    const endpointsResult = await probarEndpointsSiigo(tokenCompleto);
    
    // Respuesta final
    const response = {
      success: true,
      message: 'Pruebas de conexión con Siigo completadas',
      timestamp: new Date().toISOString(),
      results: {
        authentication: conexionResult,
        endpoints: endpointsResult
      },
      summary: {
        authenticationSuccess: conexionResult.success,
        endpointsSuccess: endpointsResult.success,
        totalEndpointsTested: endpointsResult.tests.length,
        successfulEndpoints: endpointsResult.tests.filter(t => t.success).length
      }
    };
    
    debugLog('=== PRUEBAS COMPLETADAS EXITOSAMENTE ===', response.summary);
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    debugError('=== ERROR GENERAL EN LAS PRUEBAS ===', error);
    
    return NextResponse.json({
      success: false,
      message: 'Error general en las pruebas de Siigo',
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// También permitir POST para pruebas más específicas
export async function POST(request: NextRequest): Promise<NextResponse> {
  debugLog('=== PETICIÓN POST RECIBIDA PARA PRUEBAS ESPECÍFICAS ===');
  
  try {
    const body = await request.json();
    debugLog('Parámetros de prueba recibidos:', body);
    
    // Obtener token
    const token = await obtenerTokenSiigo();
    if (!token) {
      return NextResponse.json({
        success: false,
        message: 'No se pudo obtener token de autenticación'
      }, { status: 500 });
    }
    
    // Si se especifica un endpoint específico para probar
    if (body.endpoint) {
      debugLog(`Probando endpoint específico: ${body.endpoint}`);
      
      try {
        const response = await fetch(`https://api.siigo.com${body.endpoint}`, {
          method: body.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes'
          },
          body: body.data ? JSON.stringify(body.data) : undefined
        });
        
        const data = await response.json();
        
        return NextResponse.json({
          success: response.ok,
          status: response.status,
          data: data,
          message: response.ok ? 'Prueba exitosa' : 'Error en la prueba'
        });
        
      } catch (error) {
        debugError('Error en prueba específica', error);
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }, { status: 500 });
      }
    }
    
    // Si no se especifica endpoint, hacer prueba general
    return GET(request);
    
  } catch (error) {
    debugError('Error en POST de pruebas', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
