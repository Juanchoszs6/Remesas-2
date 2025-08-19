import { NextResponse } from 'next/server'

interface EndpointTest {
  name: string;
  url: string;
  status: 'OK' | 'ERROR' | 'NOT_TESTED';
  message: string;
  responseTime?: number;
  data?: any;
}

async function testEndpoint(url: string): Promise<{ status: 'OK' | 'ERROR'; message: string; responseTime: number; data?: any }> {
  const startTime = Date.now();
  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Timeout después de 5 segundos
      signal: AbortSignal.timeout(5000)
    });
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      return {
        status: 'OK',
        message: `✅ Respuesta exitosa (${response.status})`,
        responseTime,
        data: Array.isArray(data) ? `${data.length} registros` : 'Datos disponibles'
      };
    } else {
      return {
        status: 'ERROR',
        message: `❌ Error HTTP ${response.status}`,
        responseTime
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'ERROR',
      message: `❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      responseTime
    };
  }
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  
  // Lista de endpoints a probar
  const endpoints = [
    { name: 'Productos', url: `${origin}/api/productos` },
    { name: 'Productos (búsqueda)', url: `${origin}/api/productos?q=1` },
    { name: 'Activos Fijos', url: `${origin}/api/activos-fijos` },
    { name: 'Proveedores', url: `${origin}/api/proveedores` },
    { name: 'Proveedores (búsqueda)', url: `${origin}/api/proveedores?q=test` },
    { name: 'Cuentas Contables', url: `${origin}/api/gastos_cuentas_contables` },
    { name: 'Productos Lista', url: `${origin}/api/productos-lista` },
  ];

  // Probar todos los endpoints en paralelo
  const results: EndpointTest[] = await Promise.all(
    endpoints.map(async (endpoint) => {
      const test = await testEndpoint(endpoint.url);
      return {
        name: endpoint.name,
        url: endpoint.url,
        status: test.status,
        message: test.message,
        responseTime: test.responseTime,
        data: test.data
      };
    })
  );

  // Estadísticas generales
  const totalEndpoints = results.length;
  const workingEndpoints = results.filter(r => r.status === 'OK').length;
  const failingEndpoints = results.filter(r => r.status === 'ERROR').length;
  const averageResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / totalEndpoints;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: {
      databaseUrl: process.env.DATABASE_URL ? 'Configurado ✅' : 'No configurado ❌',
      SIIGO_USERNAME: process.env.SIIGO_USERNAME || 'No configurado',
      SIIGO_PARTNER_ID: process.env.SIIGO_PARTNER_ID || 'No configurado',
      SIIGO_AUTH_URL: process.env.SIIGO_AUTH_URL || 'https://api.siigo.com/auth',
      SIIGO_ACCESS_KEY_CONFIGURED: process.env.SIIGO_ACCESS_KEY ? 'Configurado ✅' : 'No configurado ❌',
    },
    apiStatus: {
      summary: {
        total: totalEndpoints,
        working: workingEndpoints,
        failing: failingEndpoints,
        healthPercentage: Math.round((workingEndpoints / totalEndpoints) * 100),
        averageResponseTime: Math.round(averageResponseTime)
      },
      endpoints: results
    }
  });
}
