import { NextResponse } from 'next/server';

// Configuración de debugging
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    console.log(`[SIIGO-TEST-MONTHS] ${new Date().toISOString()}: ${message}`);
    if (data) {
      console.log('[SIIGO-TEST-MONTHS] Data:', JSON.stringify(data, null, 2));
    }
  }
}

function debugError(message: string, error: unknown): void {
  console.error(`[SIIGO-TEST-MONTHS] ERROR ${new Date().toISOString()}: ${message}`);
  console.error('[SIIGO-TEST-MONTHS] Error details:', error);
}

// Función para obtener token de autenticación de Siigo
async function getSiigoToken(): Promise<string | null> {
  try {
    debugLog('Obteniendo token de autenticación...');
    
    // Verificar que las variables de entorno estén definidas
    const authUrl = process.env.SIIGO_AUTH_URL;
    const username = process.env.SIIGO_USERNAME;
    const accessKey = process.env.SIIGO_ACCESS_KEY;
    const partnerId = process.env.SIIGO_PARTNER_ID;

    if (!authUrl || !username || !accessKey || !partnerId) {
      debugError('Faltan variables de entorno para la autenticación', { 
        authUrl: !!authUrl, 
        username: !!username, 
        accessKey: !!accessKey, 
        partnerId: !!partnerId 
      });
      return null;
    }
    
    debugLog('Realizando solicitud directa a Siigo Auth API', { authUrl });
    
    // Realizar solicitud directa a la API de autenticación de Siigo
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Partner-Id': partnerId,
      },
      body: JSON.stringify({
        username,
        access_key: accessKey,
      }),
    });

    if (!response.ok) {
      debugError('Error al obtener token directamente de Siigo', await response.text());
      return null;
    }

    const data = await response.json();
    debugLog('Token obtenido correctamente');
    return data.access_token;
  } catch (error) {
    debugError('Error en getSiigoToken', error);
    return null;
  }
}

// Función para probar la disponibilidad de datos en diferentes meses
async function testMonthsAvailability(token: string): Promise<any> {
  const results: any = {};
  
  // Probar diferentes filtros para entender el comportamiento de la API
  const testCases = [
    {
      name: 'Julio 2025 (específico)',
      params: {
        created_start: '2025-07-01',
        created_end: '2025-07-31',
        date: '2025-07-01',
      }
    },
    {
      name: 'Junio 2025 (específico)',
      params: {
        created_start: '2025-06-01',
        created_end: '2025-06-30',
        date: '2025-06-01',
      }
    },
    {
      name: 'Año 2024 completo',
      params: {
        created_start: '2024-01-01',
        created_end: '2024-12-31',
      }
    },
    {
      name: 'Año 2023 completo',
      params: {
        created_start: '2023-01-01',
        created_end: '2023-12-31',
      }
    },
    {
      name: 'Filtro por fecha (date) Julio 2025',
      params: {
        date: '2025-07-01',
      }
    },
    {
      name: 'Filtro por fecha (date) Junio 2025',
      params: {
        date: '2025-06-01',
      }
    },
    {
      name: 'Sin filtros de fecha',
      params: {}
    },
    {
      name: 'Filtro por ID de documento',
      params: {
        document_id: '25'
      }
    },
    {
      name: 'Filtro por estado',
      params: {
        status: 'open'
      }
    }
  ];
  
  for (const testCase of testCases) {
    debugLog(`Probando caso: ${testCase.name}`, testCase.params);
    
    try {
      // Construir la URL de la API de Siigo con los parámetros de consulta
      const queryParams = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(testCase.params)
            .map(([key, value]) => [key, String(value)])
        ),
        page: '1',
        page_size: '10',
      });

      const siigoApiUrl = `https://api.siigo.com/v1/purchases?${queryParams.toString()}`;
      
      debugLog(`Solicitando datos a Siigo API para caso: ${testCase.name}`, { url: siigoApiUrl });

      // Realizar la solicitud a la API de Siigo
      const response = await fetch(siigoApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
        },
      });
      
      if (!response.ok) {
        debugError(`Error en la respuesta de Siigo API para caso: ${testCase.name}`, {
          status: response.status,
          statusText: response.statusText,
        });
        
        results[testCase.name] = {
          success: false,
          error: `${response.status} ${response.statusText}`,
          count: 0
        };
        continue;
      }
      
      const responseData = await response.json();
      
      // Verificar si hay resultados
      const invoicesCount = responseData.results?.length || 0;
      
      results[testCase.name] = {
        success: true,
        count: invoicesCount,
        pagination: responseData.pagination || {}
      };
      
      // Si hay resultados, mostrar una muestra
      if (invoicesCount > 0) {
        const sampleInvoices = responseData.results.slice(0, 3);
        debugLog(`Muestra de facturas para caso: ${testCase.name}:`, sampleInvoices.map((invoice: any) => ({
          id: invoice.id,
          date: invoice.date,
          created: invoice.created || 'N/A',
        })));
        
        // Verificar si las fechas de las facturas coinciden con los filtros
        const dateFilter = testCase.params.date || testCase.params.created_start;
        if (dateFilter) {
          const yearMonth = dateFilter.substring(0, 7); // YYYY-MM
          const matchingDates = sampleInvoices.filter((invoice: { date: string; created: string; }) => 
            invoice.date.startsWith(yearMonth) || 
            (invoice.created && invoice.created.startsWith(yearMonth))
          );
          
          debugLog(`Coincidencia de fechas para caso ${testCase.name}:`, {
            filterYearMonth: yearMonth,
            matchingCount: matchingDates.length,
            totalSample: sampleInvoices.length
          });
        }
      } else {
        debugLog(`No se encontraron facturas para caso: ${testCase.name}`);
      }
    } catch (error) {
      debugError(`Error al probar caso: ${testCase.name}`, error);
      results[testCase.name] = {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        count: 0
      };
    }
    
    // Esperar un segundo entre solicitudes para evitar límites de tasa
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Probar una solicitud adicional para verificar si la API está devolviendo siempre los mismos datos
  try {
    debugLog('Realizando prueba adicional para verificar comportamiento de la API');
    
    // Hacer dos solicitudes idénticas para ver si devuelven los mismos resultados
    const testParams = new URLSearchParams({
      created_start: '2023-01-01',
      created_end: '2023-12-31',
      page: '1',
      page_size: '10',
    });
    
    const url = `https://api.siigo.com/v1/purchases?${testParams.toString()}`;
    
    // Primera solicitud
    const response1 = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
      },
    });
    
    const data1 = await response1.json();
    const count1 = data1.results?.length || 0;
    
    // Segunda solicitud (idéntica)
    const response2 = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
      },
    });
    
    const data2 = await response2.json();
    const count2 = data2.results?.length || 0;
    
    // Comparar resultados
    const sameCount = count1 === count2;
    const sameFirstId = count1 > 0 && count2 > 0 ? data1.results[0].id === data2.results[0].id : 'N/A';
    
    results['API_Consistency_Test'] = {
      success: true,
      sameCount,
      count1,
      count2,
      sameFirstId,
    };
    
    debugLog('Resultado de prueba de consistencia de API', {
      sameCount,
      count1,
      count2,
      sameFirstId,
    });
  } catch (error) {
    debugError('Error en prueba de consistencia de API', error);
    results['API_Consistency_Test'] = {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
  
  return results;
}

export async function GET(request: Request) {
  debugLog('Iniciando prueba de disponibilidad de datos por mes');
  
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
    
    // Probar la disponibilidad de datos en diferentes meses
    const results = await testMonthsAvailability(token);
    
    // Analizar los resultados
    const monthsWithData = Object.entries(results)
      .filter(([_, data]: [string, any]) => data.count > 0)
      .map(([month, data]: [string, any]) => ({
        month,
        count: data.count,
        pagination: data.pagination
      }));
    
    const monthsWithoutData = Object.entries(results)
      .filter(([_, data]: [string, any]) => data.count === 0 && data.success)
      .map(([month]: [string, any]) => month);
    
    const monthsWithErrors = Object.entries(results)
      .filter(([_, data]: [string, any]) => !data.success)
      .map(([month, data]: [string, any]) => ({
        month,
        error: data.error
      }));
    
    debugLog('Análisis de disponibilidad completado', {
      totalMonthsChecked: Object.keys(results).length,
      monthsWithData: monthsWithData.length,
      monthsWithoutData: monthsWithoutData.length,
      monthsWithErrors: monthsWithErrors.length
    });
    
    return NextResponse.json({
      success: true,
      results,
      summary: {
        monthsWithData,
        monthsWithoutData,
        monthsWithErrors
      }
    });
  } catch (error) {
    debugError('Error en el servidor', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}