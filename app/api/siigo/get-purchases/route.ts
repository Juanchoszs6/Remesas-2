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

interface PurchaseItem {
  type: 'Product' | 'Service' | 'Expense' | string;
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount?: number;
  taxes?: Array<{ id: number }>;
  [key: string]: unknown;
}

interface Payment {
  id: number | string;
  value: number;
  due_date: string;
  [key: string]: unknown;
}

interface PurchasePayload {
  document: { id: string | number };
  date: string;
  supplier: {
    identification: string;
    branch_office?: number;
  };
  cost_center?: number;
  provider_invoice: {
    prefix: string;
    number: string;
  };
  currency?: {
    code: string;
    exchange_rate: number;
  };
  observations?: string;
  discount_type?: 'Value' | 'Percentage';
  supplier_by_item?: boolean;
  tax_included?: boolean;
  items: PurchaseItem[];
  payments: Payment[];
  [key: string]: unknown;
}

// Debug configuration
const DEBUG = process.env.NODE_ENV === 'development';
const SIIGO_API_URL = process.env.SIIGO_API_URL || 'https://api.siigo.com/v1';
const DEFAULT_CURRENCY = { code: 'COP', exchange_rate: 1 };
const DEFAULT_TAX_ID = 13156; // Default tax ID - should be configured per environment

/**
 * Log debug information in development mode
 */
function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[SIIGO-PURCHASE-API] ${timestamp}: ${message}`);
    if (data !== undefined) {
      console.log(`[SIIGO-PURCHASE-API] Data:`, JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Log error information
 */
function debugError(message: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  console.error(`[SIIGO-PURCHASE-API] ERROR ${timestamp}: ${message}`);
  
  if (error instanceof Error) {
    console.error(`[SIIGO-PURCHASE-API] ${error.name}: ${error.message}`);
    if (error.stack) {
      console.error(`[SIIGO-PURCHASE-API] Stack: ${error.stack}`);
    }
  } else if (error !== undefined) {
    console.error('[SIIGO-PURCHASE-API] Error details:', JSON.stringify(error, null, 2));
  }
}

/**
 * Get authentication token from SIIGO API
 */
async function getSiigoToken(): Promise<string | null> {
  const functionName = 'getSiigoToken';
  debugLog(`${functionName}: Iniciando autenticación con SIIGO`);
  
  try {
    // Validate required environment variables
    const authUrl = process.env.SIIGO_AUTH_URL;
    const username = process.env.SIIGO_USERNAME;
    const accessKey = process.env.SIIGO_ACCESS_KEY;
    const partnerId = process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes';

    const missingVars = [];
    if (!authUrl) missingVars.push('SIIGO_AUTH_URL');
    if (!username) missingVars.push('SIIGO_USERNAME');
    if (!accessKey) missingVars.push('SIIGO_ACCESS_KEY');

    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
      const error = new Error(errorMsg);
      error.name = 'MissingEnvironmentVariables';
      debugError(`${functionName}: ${errorMsg}`, error);
      console.error('Missing environment variables:', missingVars);
      return null;
    }
    
    // At this point, we've already validated that authUrl is defined
    const authEndpoint = authUrl as string;
    debugLog(`${functionName}: Solicitando token a ${authEndpoint}`);
    
    const startTime = Date.now();
    const response = await fetch(authEndpoint, {
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

    const responseTime = Date.now() - startTime;
    debugLog(`${functionName}: Respuesta recibida en ${responseTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      debugError(`${functionName}: Error en la autenticación (${response.status})`, {
        status: response.status,
        statusText: response.statusText,
        response: errorText
      });
      return null;
    }

    const data: SiigoTokenResponse = await response.json();
    
    if (!data.access_token) {
      debugError(`${functionName}: No se recibió token en la respuesta`, data);
      return null;
    }
    
    debugLog(`${functionName}: Autenticación exitosa`);
    return data.access_token;
  } catch (error) {
    debugError(`${functionName}: Error en la autenticación`, error);
    return null;
  }
}

/**
 * Validate purchase payload against SIIGO requirements
 */
function validatePurchasePayload(body: any): { isValid: boolean; error?: SiigoError; missingFields?: string[] } {
  const requiredFields = [
    { path: 'document.id', value: body.document?.id || body.documentId },
    { path: 'date', value: body.date || body.invoiceDate },
    { 
      path: 'supplier.identification', 
      value: body.supplier?.identification || body.providerCode || body.provider?.codigo || body.provider?.identificacion 
    },
  ];

  // Check required fields
  const missing = requiredFields.filter(f => !f.value);
  if (missing.length > 0) {
    return {
      isValid: false,
      error: {
        message: 'Missing required fields',
        details: { missingFields: missing.map(f => f.path) }
      },
      missingFields: missing.map(f => f.path as string)
    };
  }

  // Validate items
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return {
      isValid: false,
      error: {
        message: 'At least one item is required',
        code: 'ITEMS_REQUIRED'
      }
    };
  }

  // Validate each item
  const itemErrors: { index: number; field: string }[] = [];
  body.items.forEach((item: any, index: number) => {
    if (!item.code) itemErrors.push({ index, field: 'code' });
    if (!item.description) itemErrors.push({ index, field: 'description' });
    if (item.quantity === undefined || item.quantity === null) itemErrors.push({ index, field: 'quantity' });
    if (item.price === undefined || item.price === null) itemErrors.push({ index, field: 'price' });
  });

  if (itemErrors.length > 0) {
    return {
      isValid: false,
      error: {
        message: 'Invalid item data',
        details: { itemErrors }
      }
    };
  }

  return { isValid: true };
}

/**
 * Map form data to SIIGO purchase payload
 */
function mapToSiigoPayload(body: any): PurchasePayload {
  // Calculate item totals (base amount without tax)
  const calculateItemBaseTotal = (item: any) => {
    const quantity = Number(item.quantity) || 1;  
    const price = Number(item.price) || 0;
    const discount = Number(item.discount) || 0;
    
    // Calculate base value: (quantity * price) - discount
    const baseValue = Math.round((quantity * price - discount) * 100) / 100;
    
    return {
      baseValue,
      // Calculate tax for reference (not used in the final total)
      taxAmount: 0,
      total: baseValue // Total is just the base value for the API
    };
  };

  // Process items and calculate base total (without tax)
  let itemsWithTotals: any[] = [];
  let baseTotal = 0;

  if (Array.isArray(body.items)) {
    itemsWithTotals = body.items.map((item: any) => {
      const itemTotal = calculateItemBaseTotal(item);
      baseTotal += itemTotal.baseValue;
      
      // Return item with tax information (tax is calculated by Siigo)
      return {
        ...item,
        price: item.price, // Keep original price
        discount: item.discount || 0,
        taxes: [{
          id: 18384, // Default tax ID
          tax_base: itemTotal.baseValue,
          type: 'IVA',
          percentage: 19
        }]
      };
    });
  }

  // Round base total to 2 decimal places
  baseTotal = Math.round(baseTotal * 100) / 100;
  
  // Debug log the calculated base total
  debugLog('Calculated base total:', { baseTotal });

  // Process payments - ensure we always have at least one payment with the base total (without tax)
  let payments = [];
  
  if (Array.isArray(body.payments) && body.payments.length > 0) {
    // Use the first payment method from the request, or default to 0 (let API decide)
    const paymentMethodId = body.payments[0]?.id || 0;
    const dueDate = body.payments[0]?.due_date || body.payments[0]?.dueDate || 
                   (body.dueDate || body.date || new Date().toISOString().split('T')[0]);
    
    // Create a single payment with the base total (without tax)
    payments = [{
      id: paymentMethodId,
      value: baseTotal, // Use base total (without tax)
      due_date: dueDate,
      ...(body.payments[0]?.metadata || {})
    }];
  } else {
    // Default payment if none provided
    payments = [{
      id: 0, // Let API decide the default payment method
      value: baseTotal, // Use base total (without tax)
      due_date: (body.dueDate || body.date || new Date().toISOString().split('T')[0])
    }];
  }
  
  // Debug log the payments for verification
  debugLog('Processed payments:', { payments, baseTotal });

  // Crear un objeto de factura con tipos estrictos
  // Usar el formato exacto de la documentación de Siigo
  const invoiceNumber = String(body.providerInvoiceNumber || '1234');
  
  // Crear el payload con tipos explícitos
  const payload: PurchasePayload = {
    document: { 
      id: body.document?.id || body.documentId 
    },
    date: (body.invoiceDate || body.date || new Date().toISOString()).split('T')[0],
    supplier: {
      identification: String(body.supplier?.identification || body.providerCode || body.provider?.codigo || body.provider?.identificacion || ''),
      branch_office: Number(body.supplier?.branch_office || body.branchOffice || 0)
    },
    provider_invoice: {
      prefix: String(body.providerInvoicePrefix || 'FC'),
      number: invoiceNumber.replace(/[^0-9]/g, '') // Asegurar que solo tenga números
    },
    observations: body.observations || body.notes || '',
    discount_type: body.discountType || 'Value',
    supplier_by_item: false,
    tax_included: false,
    items: (body.items || []).map((item: any) => ({
      type: item.type === 'product' ? 'Product' : (item.type || 'Product'),
      code: item.code,
      description: item.description || `Item ${item.code}`,
      quantity: item.quantity,
      price: item.price,
      discount: item.discount || 0,
      taxes: Array.isArray(item.taxes) && item.taxes.length > 0 
        ? item.taxes.map((t: any) => (typeof t === 'number' ? { id: t } : t))
        : [{ id: body.defaultTaxId || DEFAULT_TAX_ID }],
      ...(item.metadata || {}) // Allow additional fields
    })),
    payments: payments
  };
  
  return payload;
}
/**
 * POST handler for creating a new purchase in SIIGO
 */
export async function POST(request: Request) {
  const functionName = 'POST /api/siigo/get-purchases';
  debugLog(`${functionName}: Iniciando proceso de factura`);
  
  try {
    // Parse and validate request body
    let body: any;
    try {
      body = await request.json();
      debugLog(`${functionName}: Datos recibidos del formulario`, body);
    } catch (parseError) {
      debugError(`${functionName}: Error al analizar el cuerpo de la solicitud`, parseError);
      return NextResponse.json(
        { error: 'Formato de solicitud inválido' },
        { status: 400 }
      );
    }

    // Get authentication token
    const token = await getSiigoToken();
    if (!token) {
      debugError(`${functionName}: Falló la autenticación con SIIGO`, null);
      return NextResponse.json(
        { 
          error: 'No se pudo autenticar con SIIGO',
          code: 'AUTHENTICATION_FAILED'
        },
        { status: 401 }
      );
    }

    // Validate payload
    const validation = validatePurchasePayload(body);
    if (!validation.isValid) {
      debugError(`${functionName}: Validación fallida`, validation.error);
      return NextResponse.json(
        { 
          error: 'Datos de facturación inválidos',
          ...validation.error,
          code: validation.error?.code || 'VALIDATION_ERROR'
        },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Map to SIIGO format
    const siigoPayload = mapToSiigoPayload(body);
    
    // 1. Asegurarnos de que el número de factura sea un string
    if (siigoPayload.provider_invoice) {
      siigoPayload.provider_invoice.number = String(siigoPayload.provider_invoice.number);
    }
    
    // 2. Crear una copia profunda del payload para verificación
    const payloadForApi = JSON.parse(JSON.stringify(siigoPayload));
    
    // 3. Verificar tipos de datos críticos
    const typeVerification = {
      'provider_invoice.number': {
        value: payloadForApi.provider_invoice?.number,
        type: typeof payloadForApi.provider_invoice?.number,
        required: 'string',
        valid: typeof payloadForApi.provider_invoice?.number === 'string'
      },
      'document.id': {
        value: payloadForApi.document?.id,
        type: typeof payloadForApi.document?.id,
        required: 'number or string',
        valid: ['number', 'string'].includes(typeof payloadForApi.document?.id)
      },
      'supplier.identification': {
        value: payloadForApi.supplier?.identification,
        type: typeof payloadForApi.supplier?.identification,
        required: 'string',
        valid: typeof payloadForApi.supplier?.identification === 'string'
      }
    };
    
    // 4. Verificar si hay algún tipo incorrecto
    const typeErrors = Object.entries(typeVerification)
      .filter(([_, data]: [string, any]) => !data.valid)
      .map(([field, data]: [string, any]) => ({
        field,
        value: data.value,
        actualType: data.type,
        expectedType: data.required
      }));
    
    if (typeErrors.length > 0) {
      const errorMessage = `Error de validación de tipos: ${typeErrors.map(e => 
        `${e.field} (tipo: ${e.actualType}, esperado: ${e.expectedType})`
      ).join(', ')}`;
      
      return NextResponse.json(
        { 
          error: 'Error de validación de tipos',
          details: typeErrors,
          code: 'TYPE_VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }
    
    debugLog(`${functionName}: Payload verificado para SIIGO`, payloadForApi);

    // 5. Serializar manualmente el payload para asegurar el formato correcto
    const requestBody = JSON.stringify({
      ...payloadForApi,
      provider_invoice: {
        ...payloadForApi.provider_invoice,
        // Asegurar que el número sea un string, incluso si se perdió en la copia
        number: String(payloadForApi.provider_invoice.number)
      }
    });
    
    // 6. Enviar a la API de SIIGO con el payload verificado
    const startTime = Date.now();
    const response = await fetch(`${SIIGO_API_URL}/purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes',
      },
      // Usar el body ya serializado manualmente
      body: requestBody
    });

    const responseTime = Date.now() - startTime;
    const result = await response.json().catch(() => ({}));
    
    debugLog(`${functionName}: Respuesta de SIIGO recibida en ${responseTime}ms`, {
      status: response.status,
      statusText: response.statusText,
      response: result
    });

    // Handle SIIGO API response
    if (!response.ok) {
      debugError(`${functionName}: Error en la API de SIIGO`, {
        status: response.status,
        statusText: response.statusText,
        response: result,
        payload: siigoPayload
      });

      return NextResponse.json(
        {
          error: 'Error al procesar la factura en SIIGO',
          details: result,
          code: 'SIIGO_API_ERROR',
          status: response.status
        },
        { 
          status: response.status >= 500 ? 502 : 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Success response
    debugLog(`${functionName}: Factura procesada exitosamente`, result);
    return NextResponse.json(
      { 
        success: true,
        data: result,
        message: 'Factura procesada exitosamente'
      },
      { 
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    // Handle unexpected errors
    debugError(`${functionName}: Error inesperado`, error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido',
        code: 'INTERNAL_SERVER_ERROR'
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('created_start') || '';
  const endDate = searchParams.get('created_end') || '';
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('page_size') || '50';
  const getAllPages = searchParams.get('get_all_pages') === 'true';
  
  // Convertir fechas a objetos Date para filtrado posterior
  const startDateObj = startDate ? new Date(startDate) : null;
  const endDateObj = endDate ? new Date(endDate) : null;

  debugLog('Solicitud de compras recibida', { startDate, endDate, page, pageSize, getAllPages });

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

    // Función para obtener una página de resultados
    async function fetchPage(pageNum: string) {
      const queryParams = new URLSearchParams({
        ...(startDate && { created_start: startDate }),
        ...(endDate && { created_end: endDate }),
        page: pageNum,
        page_size: pageSize,
      });

      const siigoApiUrl = `https://api.siigo.com/v1/purchases?${queryParams.toString()}`;
      
      debugLog(`Solicitando datos a Siigo API - Página ${pageNum}`, { url: siigoApiUrl });

      const response = await fetch(siigoApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasApp',
        },
      });
      
      if (!response.ok) {
        debugError(`Error en la respuesta de Siigo API - Página ${pageNum}`, {
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`Error al obtener la página ${pageNum}: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    }

    // Si se solicitan todas las páginas, obtener múltiples páginas
    if (getAllPages) {
      debugLog('Obteniendo todas las páginas de resultados');
      
      // Obtener la primera página para saber el total de páginas
      const firstPageData = await fetchPage('1');
      
      if (!firstPageData || !firstPageData.results) {
        debugError('Formato de respuesta inesperado en la primera página', firstPageData);
        return NextResponse.json(
          { error: 'Formato de respuesta inesperado de Siigo API' },
          { status: 500 }
        );
      }
      
      // Calcular el número total de páginas
      const totalItems = firstPageData.pagination?.total_items || 0;
      const itemsPerPage = parseInt(pageSize);
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      
      debugLog('Información de paginación', { 
        totalItems, 
        itemsPerPage, 
        totalPages,
        currentResults: firstPageData.results.length
      });
      
      // Si solo hay una página, filtrar los resultados por fecha y devolverlos
      if (totalPages <= 1) {
        debugLog('Solo hay una página de resultados, filtrando por fecha');
        
        // Verificar las fechas de las facturas recibidas
        if (firstPageData.results && Array.isArray(firstPageData.results)) {
          const sampleInvoices = firstPageData.results.slice(0, 5);
          debugLog('Muestra de fechas de facturas (antes de filtrar):', sampleInvoices.map((invoice: any) => ({
            id: invoice.id,
            date: invoice.date,
            created: invoice.created,
          })));
          
          // Filtrar resultados por fecha si se especificaron fechas
          if (startDateObj || endDateObj) {
            debugLog('Aplicando filtro de fechas en el servidor', { startDate, endDate });
            
            const filteredResults = firstPageData.results.filter((invoice: any) => {
              const invoiceDate = new Date(invoice.date);
              
              // Verificar si la fecha de la factura está dentro del rango especificado
              const afterStartDate = startDateObj ? invoiceDate >= startDateObj : true;
              const beforeEndDate = endDateObj ? invoiceDate <= endDateObj : true;
              
              return afterStartDate && beforeEndDate;
            });
            
            debugLog(`Resultados después de filtrar por fecha: ${filteredResults.length} de ${firstPageData.results.length}`);
            
            // Actualizar los resultados y la paginación
            const filteredResponse = {
              ...firstPageData,
              results: filteredResults,
              pagination: {
                ...firstPageData.pagination,
                total_items: filteredResults.length,
                filtered_by_server: true
              }
            };
            
            return NextResponse.json(filteredResponse);
          }
        }
        
        return NextResponse.json(firstPageData);
      }
      
      // Obtener el resto de las páginas (máximo 5 páginas para evitar sobrecarga)
      const maxPages = Math.min(totalPages, 5);
      debugLog(`Obteniendo ${maxPages} páginas de resultados`);
      
      const pagePromises = [];
      for (let i = 2; i <= maxPages; i++) {
        pagePromises.push(fetchPage(i.toString()));
      }
      
      // Esperar a que todas las solicitudes se completen
      const additionalPagesData = await Promise.all(pagePromises);
      
      // Combinar los resultados de todas las páginas
      const allResults = [...firstPageData.results];
      
      for (const pageData of additionalPagesData) {
        if (pageData && pageData.results && Array.isArray(pageData.results)) {
          allResults.push(...pageData.results);
        }
      }
      
      // Verificar las fechas de una muestra de facturas antes de filtrar
      const sampleInvoices = allResults.slice(0, 5);
      debugLog('Muestra de fechas de facturas (combinadas, antes de filtrar):', sampleInvoices.map((invoice: any) => ({
        id: invoice.id,
        date: invoice.date,
        created: invoice.created,
      })));
      
      // Filtrar resultados por fecha si se especificaron fechas
      let filteredResults = allResults;
      if (startDateObj || endDateObj) {
        debugLog('Aplicando filtro de fechas en el servidor para resultados combinados', { startDate, endDate });
        
        filteredResults = allResults.filter((invoice: any) => {
          const invoiceDate = new Date(invoice.date);
          
          // Verificar si la fecha de la factura está dentro del rango especificado
          const afterStartDate = startDateObj ? invoiceDate >= startDateObj : true;
          const beforeEndDate = endDateObj ? invoiceDate <= endDateObj : true;
          
          return afterStartDate && beforeEndDate;
        });
        
        debugLog(`Resultados después de filtrar por fecha: ${filteredResults.length} de ${allResults.length}`);
      }
      
      // Crear un objeto de respuesta combinado
      const combinedResponse = {
        ...firstPageData,
        results: filteredResults,
        pagination: {
          ...firstPageData.pagination,
          page: '1',
          pages_fetched: maxPages,
          total_items: filteredResults.length,
          original_total_items: allResults.length,
          filtered_by_server: startDateObj || endDateObj ? true : false
        }
      };
      
      debugLog('Datos combinados de múltiples páginas', { 
        totalPages: maxPages,
        totalResultsBeforeFilter: allResults.length,
        totalResultsAfterFilter: filteredResults.length
      });
      
      return NextResponse.json(combinedResponse);
    } else {
      // Comportamiento original: obtener solo una página
      const responseData = await fetchPage(page);
      
      // Verificar las fechas de las facturas recibidas
      if (responseData.results && Array.isArray(responseData.results)) {
        const sampleInvoices = responseData.results.slice(0, 5);
        debugLog('Muestra de fechas de facturas (antes de filtrar):', sampleInvoices.map((invoice: any) => ({
          id: invoice.id,
          date: invoice.date,
          created: invoice.created,
        })));
        
        // Filtrar resultados por fecha si se especificaron fechas
        if (startDateObj || endDateObj) {
          debugLog('Aplicando filtro de fechas en el servidor (página única)', { startDate, endDate });
          
          const originalCount = responseData.results.length;
          
          const filteredResults = responseData.results.filter((invoice: any) => {
            const invoiceDate = new Date(invoice.date);
            
            // Verificar si la fecha de la factura está dentro del rango especificado
            const afterStartDate = startDateObj ? invoiceDate >= startDateObj : true;
            const beforeEndDate = endDateObj ? invoiceDate <= endDateObj : true;
            
            return afterStartDate && beforeEndDate;
          });
          
          debugLog(`Resultados después de filtrar por fecha: ${filteredResults.length} de ${originalCount}`);
          
          // Actualizar los resultados y la paginación
          responseData.results = filteredResults;
          if (responseData.pagination) {
            responseData.pagination.total_items = filteredResults.length;
            responseData.pagination.original_total_items = originalCount;
            responseData.pagination.filtered_by_server = true;
          }
        }
      }

      debugLog('Datos recibidos de Siigo API (página única)', { 
        count: responseData.results?.length || 0,
        filtered: startDateObj || endDateObj ? true : false
      });

      return NextResponse.json(responseData);
    }
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
