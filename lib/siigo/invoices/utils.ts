import { SiigoApiError } from '../api';
import { SiigoQueryParams, SiigoApiHeaders, SiigoApiResponse } from '@/types/facturas';

export const SIIGO_INVOICE_TYPES = {
  FC: 'FC',  // Factura de Venta
  ND: 'ND',  // Nota Débito
  DS: 'DS',  // Documento Soporte
  RP: 'RP'   // Recibo de Pago
} as const;

type InvoiceType = keyof typeof SIIGO_INVOICE_TYPES;

const SIIGO_API_BASE_URL = 'https://api.siigo.com/v1';

export async function fetchInvoices<T>(
  type: InvoiceType,
  token: string,
  params: Record<string, string | number | boolean> = {}
): Promise<SiigoApiResponse<T[]>> {
  try {
    const headers: SiigoApiHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Construir URL con parámetros
    const url = new URL(`${SIIGO_API_BASE_URL}/document-types`);
    url.searchParams.append('type', type);
    
    // Agregar otros parámetros
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new SiigoApiError(
        errorData.message || `Error al obtener documentos de tipo ${type}`,
        response.status,
        errorData
      );
    }

    const data = await response.json();
    return { success: true, data };
    
  } catch (error) {
    console.error(`Error en fetchInvoices (${type}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      status: error instanceof SiigoApiError ? error.code : 500
    };
  }
}
