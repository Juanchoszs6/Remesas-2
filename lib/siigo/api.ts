export interface SiigoApiResponse<T> {
  results: T[];
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    next?: string;
    previous?: string | null;
  };
}

export interface SiigoPurchaseInvoice {
  id: string;
  number: string;
  prefix?: string;
  date: string;
  due_date?: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  balance: number;
  currency: {
    code: string;
    exchange_rate?: number;
  };
  supplier: {
    id?: string;
    identification: string;
    name: string;
    branch_office?: number;
  };
  items: Array<{
    id: string;
    code: string;
    description: string;
    quantity: number;
    price: number;
    discount?: {
      percentage?: number;
      value?: number;
    };
    taxes?: Array<{
      id: number;
      name: string;
      type: string;
      percentage: number;
      value: number;
    }>;
    total: number;
  }>;
  payments?: Array<{
    id: number;
    name: string;
    value: number;
    due_date?: string;
  }>;
  observations?: string;
  document_type?: string;
  document_number?: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    created: string;
    last_updated?: string;
  };
}

export class SiigoApiError extends Error {
  public readonly code?: string | number;
  public readonly details?: Record<string, unknown>;
  
  constructor(message: string, code?: string | number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SiigoApiError';
    this.code = code;
    this.details = details;
  }
}

export async function fetchSiigoData<T>(
  endpoint: string,
  authToken: string,
  params: Record<string, string | number | boolean> = {}
): Promise<SiigoApiResponse<T>> {
  const query = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });

  const baseUrl = process.env.SIIGO_API_URL || 'https://api.siigo.com/v1';
  const url = `${baseUrl}/${endpoint.replace(/^\/+|\/+$/g, '')}${query.toString() ? `?${query}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = data.message || response.statusText;
      throw new SiigoApiError(
        `Siigo API error: ${errorMessage}`,
        data.code || response.status,
        data.details
      );
    }

    return data as SiigoApiResponse<T>;
  } catch (error) {
    console.error('Error in fetchSiigoData:', error);
    if (error instanceof SiigoApiError) {
      throw error;
    }
    throw new SiigoApiError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      'UNKNOWN_ERROR'
    );
  }
}

export async function fetchAllPages<T>(
  endpoint: string,
  authToken: string,
  pageSize = 30,
): Promise<T[]> {
  const siigoApiUrl = process.env.SIIGO_API_URL || 'https://api.siigo.com/v1';
  const allItems: T[] = [];
  let currentPage = 1;
  let hasMorePages = true;
  const maxRetries = 3;
  const retryDelay = 1000; // 1 segundo

  while (hasMorePages) {
    let retries = 0;
    let success = false;
    
    while (retries < maxRetries && !success) {
      try {
        const url = new URL(`${siigoApiUrl}${endpoint}`);
        url.searchParams.append('page', currentPage.toString());
        url.searchParams.append('page_size', pageSize.toString());

        console.log(`[SIIGO-API] Fetching ${url.toString()}`);
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Partner-Id': process.env.SIIGO_PARTNER_ID || '',
          },
          next: { revalidate: 300 }, // Cache de 5 minutos
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
        }

        const data: SiigoApiResponse<T> = await response.json();
        
        if (!data.results || data.results.length === 0) {
          hasMorePages = false;
          success = true;
          break;
        }

        allItems.push(...data.results);
        
        // Verificar si hay más páginas
        if (!data.pagination || !data.pagination.next) {
          hasMorePages = false;
        } else {
          currentPage++;
          // Pequeño retraso entre peticiones para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        success = true;
        
      } catch (error) {
        retries++;
        console.error(`[SIIGO-API] Error en intento ${retries}:`, error);
        
        if (retries >= maxRetries) {
          console.error(`[SIIGO-API] Se agotaron los reintentos para la página ${currentPage}`);
          hasMorePages = false;
        } else {
          // Esperar antes de reintentar (backoff exponencial)
          const delay = retryDelay * Math.pow(2, retries - 1);
          console.log(`[SIIGO-API] Reintentando en ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!success) {
      break;
    }
  }

  console.log(`[SIIGO-API] Total de registros obtenidos: ${allItems.length}`);
  return allItems;
}
