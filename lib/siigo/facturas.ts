import type { FiltrosFactura, RespuestaPaginada } from '@/types/facturas';

// Definir constantes locales para evitar dependencias circulares
const CODIGOS_DOCUMENTO = {
  FACTURA: 'FAC',
  NOTA_CREDITO: 'NCE',
  NOTA_DEBITO: 'NDE',
  // Agregar más códigos según sea necesario
} as const;
import { getSiigoToken } from '@/app/api/siigo/obtener-token/route';

// Definir el tipo de factura de Siigo
interface ClienteSiigo {
  identification?: string;
  name?: string;
  [key: string]: unknown;
}

interface FacturaSiigo {
  id: string;
  number: string;
  date: string;
  customer: ClienteSiigo;
  status: string;
  total: number;
  [key: string]: unknown;
}

interface PaginationData {
  page: number;
  page_size: number;
  total_results: number;
  total_pages: number;
}

interface SiigoApiResponse {
  results?: FacturaSiigo[];
  pagination?: PaginationData;
  [key: string]: unknown;
}

/**
 * Obtiene facturas de Siigo según los filtros proporcionados
 * @param tipoDocumento - Tipo de documento a buscar (ej: 'FACTURA', 'NOTA_CREDITO')
 * @param filtros - Filtros opcionales para la búsqueda
 * @returns Promesa con la respuesta paginada de facturas
 */
export async function obtenerFacturasSiigo(
  tipoDocumento: string,
  filtros: FiltrosFactura & {
    endpoint?: string;
    paramTipo?: string;
  } = {}
): Promise<RespuestaPaginada<FacturaSiigo>> {
  try {
    const token = await getSiigoToken();
    // Obtener el código de documento de forma segura
    const codigoDocumento = (CODIGOS_DOCUMENTO as Record<string, string>)[tipoDocumento] || '';
    
    // Construir parámetros base de la API
    const params: Record<string, string> = {
      'page': (filtros.pagina || 1).toString(),
      'page_size': (filtros.porPagina || 20).toString(),
      'order': `${filtros.ordenarPor || 'date'} ${filtros.orden || 'desc'}`.trim()
    };
    
    // Agregar filtros de fecha solo si están presentes
    if (filtros.fechaInicio) params['date_gt'] = filtros.fechaInicio;
    if (filtros.fechaFin) params['date_lt'] = filtros.fechaFin;

    // Manejar el tipo de documento según corresponda
    if (tipoDocumento === 'FACTURA') {
      // Solo para facturas usamos el código del documento
      params['document.id'] = codigoDocumento.toString();
    } else if (filtros.paramTipo) {
      // Para otros tipos de documentos (notas de crédito, débito, etc.)
      params[filtros.paramTipo] = tipoDocumento.toLowerCase();
    }

    // Agregar parámetros opcionales si existen
    if (filtros.clienteId) params['customer.id'] = filtros.clienteId;
    if (filtros.estado) params.status = filtros.estado.toLowerCase();
    if (filtros.vendedorId) params.seller = filtros.vendedorId;
    if (filtros.textoBusqueda) params.q = filtros.textoBusqueda;
    
    // Parámetros de paginación
    params.page = (filtros.pagina || 1).toString();
    params.page_size = (filtros.porPagina || 20).toString();
    
    // Ordenamiento
    const sortField = filtros.ordenarPor || 'date';
    const sortOrder = (filtros.orden || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    params.order = `${sortField} ${sortOrder}`.trim();

    // Eliminar parámetros vacíos y asegurar que sean strings
    (Object.keys(params) as Array<keyof typeof params>).forEach(key => {
      const value = params[key];
      if (value === undefined || value === '' || value === null) {
        delete params[key];
      } else {
        params[key] = String(value);
      }
    });

    // Construir URL basada en el tipo de documento
    const baseUrl = (process.env.SIIGO_API_URL || 'https://api.siigo.com/v1').replace(/\/$/, '');
    const endpoint = filtros.endpoint || 'invoices';
    
    // Configurar parámetros específicos del tipo de documento
    if (filtros.paramTipo && tipoDocumento) {
      params[filtros.paramTipo] = tipoDocumento.toLowerCase();
    }
    
    // Construir URL base
    const url = new URL(`${baseUrl}/${endpoint}`);
    
    // Agregar parámetros de consulta
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        // Manejar parámetros anidados (ej: document.id)
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          url.searchParams.append(`${parent}[${child}]`, String(value));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });
    
    console.log(`[Siigo API] Solicitando a: ${url}`);

    // Realizar la petición con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout

    try {
      console.log('Solicitando a:', url.toString());
      // Configurar headers necesarios para la API de Siigo
      // Configurar headers
      const headers = new Headers({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Partner-Id': 'RemesasYDespachos' // Agregar Partner-Id requerido
      });
      
      const requestOptions: RequestInit = {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
        referrerPolicy: 'no-referrer' as const
      };
      
      console.log(`[Siigo API] Solicitando a:`, url.toString());
      console.log(`[Siigo API] Headers:`, Object.fromEntries(headers.entries()));
      
      // Realizar la petición
      const response = await fetch(url.toString(), requestOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
          // Intentar parsear como JSON si es posible
          const errorData = JSON.parse(errorText);
          errorText = JSON.stringify(errorData, null, 2);
        } catch (e) {
          // Si no es JSON, usar el texto plano
          console.error('Error al parsear respuesta de error:', e);
        }
        
        let errorMessage = `Error ${response.status} (${response.statusText}) al obtener ${tipoDocumento.toLowerCase()}s`;
        
        try {
          const errorData = JSON.parse(errorText);
          const errorDetails = {
            status: response.status,
            statusText: response.statusText,
            errorData,
            url,
            method: 'GET',
            headers: Object.fromEntries(Array.from(headers.entries()) as Array<[string, string]>)
          };
          
          console.error('[Siigo API Error]', JSON.stringify(errorDetails, null, 2));
          
          // Extraer mensaje de error de la respuesta
          if (errorData && typeof errorData === 'object') {
            errorMessage = [
              errorData.message,
              errorData.detail,
              errorData.error,
              errorData.title
            ].filter(Boolean).join(' - ') || errorMessage;
          }
        } catch (parseError) {
          console.error('[Siigo API] Error al analizar respuesta de error:', {
            error: parseError,
            responseText: errorText,
            status: response.status,
            statusText: response.statusText,
            url
          });
          
          errorMessage = `Error ${response.status}: ${errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json() as SiigoApiResponse;
      const resultados = Array.isArray(data) ? data : (data.results || []);
      const pagination = data.pagination || {
        page: parseInt(params.page || '1'),
        page_size: parseInt(params.page_size || '20'),
        total_results: resultados.length,
        total_pages: Math.ceil(resultados.length / parseInt(params.page_size || '20'))
      };

      return {
        success: true,
        data: resultados,
        paginacion: {
          pagina: pagination.page,
          porPagina: pagination.page_size,
          total: pagination.total_results,
          totalPaginas: pagination.total_pages
        }
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('La solicitud a la API de Siigo ha excedido el tiempo de espera');
      }
      throw error;
    }
  } catch (error: unknown) {
    console.error(`Error al obtener facturas ${tipoDocumento}:`, error);
    
    // Manejo seguro del error
    let errorMessage = 'Error interno del servidor';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      try {
        const errorObj = error as { message?: unknown; error?: unknown };
        if (typeof errorObj.message === 'string') {
          errorMessage = errorObj.message;
        } else if (typeof errorObj.error === 'string') {
          errorMessage = errorObj.error;
        } else {
          errorMessage = JSON.stringify(error, Object.getOwnPropertyNames(error));
        }
      } catch (stringifyError) {
        console.error('Error al convertir el error a string:', stringifyError);
        errorMessage = 'Error desconocido al procesar la respuesta';
      }
    }
    
    return {
      success: false,
      data: [],
      paginacion: {
        pagina: filtros.pagina || 1,
        porPagina: filtros.porPagina || 20,
        total: 0,
        totalPaginas: 0
      },
      error: errorMessage
    };
  }
}

/**
 * Formatea una fecha al formato YYYY-MM-DD
 * @param fecha - Fecha a formatear (string o objeto Date)
 * @returns Fecha formateada como string YYYY-MM-DD
 */
export function formatearFecha(fecha: string | Date): string {
  try {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) {
      throw new Error('Fecha inválida');
    }
    return d.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error al formatear fecha:', error);
    return ''; // O podrías lanzar el error si prefieres manejo estricto
  }
}

/**
 * Obtiene el rango de fechas por defecto (últimos 30 días)
 * @returns Objeto con fechaInicio y fechaFin formateadas
 */
export function obtenerRangoFechasPorDefecto() {
  try {
    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - 30);
    
    return {
      fechaInicio: formatearFecha(fechaInicio),
      fechaFin: formatearFecha(fechaFin)
    };
  } catch (error) {
    console.error('Error al obtener rango de fechas por defecto:', error);
    // Valores por defecto en caso de error
    return {
      fechaInicio: formatearFecha(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      fechaFin: formatearFecha(new Date())
    };
  }
}
