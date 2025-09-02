import { NextResponse } from 'next/server';

const SIIGO_BASE = (process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1').replace(/\/$/, '');
const SIIGO_AUTH = (process.env.SIIGO_AUTH_URL || 'https://api.siigo.com/auth').replace(/\/$/, '');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

const CACHE_DURATION_MS = 10 * 60 * 1000;
const PAGE_SIZE_DEFAULT = 50;

//tipos para el api de siigo
interface TestResult {
  test: string;
  error?: string;
  url: string;
}

interface PurchaseFilters {
  [key: string]: string | number | boolean | undefined;
}

interface PurchaseDiagnostics {
  purchases: Purchase[];
  pagesFetched: number;
  totalFromAPI: number;
  diagnostics: {
    testResults?: (TestResult & { 
      totalFound?: number; 
      itemsInPage?: number; 
      sampleItem?: Record<string, unknown> 
    })[];
    monthlyBreakdown?: Record<string, number>;
    statusBreakdown?: Record<string, number>;
    dateRanges?: { min?: Date; max?: Date };
    sampleInvoices?: Partial<Purchase>[];
    issues?: {
      missingDates: number;
      wrongYear: number;
      totalAnalyzed: number;
    };
    //porpiedades adicionales de siigo 
    analysis?: PurchaseAnalysis;
    apiEndpoint?: string;
    requestedFilters?: Record<string, unknown>;
    recommendations?: string[];
  };
}

interface AuthRequestBody {
  username: string | undefined;
  access_key: string | undefined;
  partner_id?: string;
  [key: string]: string | number | boolean | undefined;
}

interface Purchase {
  id?: string;
  date?: string | number | Date;
  issue_date?: string | number | Date;
  issueDate?: string | number | Date;
  fecha?: string | number | Date;
  fecha_emision?: string | number | Date;
  created_at?: string | number | Date;
  updated_at?: string | number | Date;
  metadata?: {
    created?: string | number | Date;
    created_at?: string | number | Date;
    date?: string | number | Date;
    [key: string]: unknown;
  };
  document?: {
    date?: string | number | Date;
    fecha?: string | number | Date;
    issue_date?: string | number | Date;
    [key: string]: unknown;
  };
  timestamp?: string | number | Date;
  datetime?: string | number | Date;
  created?: string | number | Date;
  emitted_at?: string | number | Date;
  [key: string]: unknown;
}

interface SiigoPagination {
  page?: number;
  page_size?: number;
  total_results?: number;
  total?: number;
  [key: string]: unknown;
}

interface SiigoResponse<T = Record<string, unknown>> {
  results?: T[];
  data?: T[];
  purchases?: T[];
  items?: T[];
  pagination?: SiigoPagination;
  meta?: SiigoPagination;
  [key: string]: unknown;
}

interface ApiResponse {
  success: boolean;
  purchases: Purchase[];
  count: number;
  year: number;
  pagesFetched: number;
  totalFromAPI?: number;
  cached?: boolean;
  processingTimeMs?: number;
  diagnostics?: Record<string, unknown>;
  monthlyBreakdown?: Record<string, number>;
  statusBreakdown?: Record<string, number>;
  recommendations?: string[];
  analysis?: Record<string, unknown>;
  dateRanges?: { min?: string; max?: string };
}

interface CacheEntry<T = Purchase> {
  ts: number;
  data: T[];
  pagesFetched: number;
  totalFromAPI: number;
  monthlyBreakdown?: Record<string, number>;
  statusBreakdown?: Record<string, number>;
  diagnostics?: Record<string, unknown>;
}

let cachedToken: string | null = null;
let cachedTokenExpiry = 0;
let tokenPromise: Promise<string> | null = null;
const purchasesCache = new Map<string, CacheEntry>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type LogMethod = (...args: unknown[]) => void;

interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
}

const log: Logger = {
  debug: (...args: unknown[]) => console.debug('[siigo-diagnostic]', ...args),
  info: (...args: unknown[]) => console.info('[siigo-diagnostic]', ...args),
  warn: (...args: unknown[]) => console.warn('[siigo-diagnostic]', ...args),
  error: (...args: unknown[]) => console.error('[siigo-diagnostic]', ...args)
};

export async function getSiigoToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) return cachedToken;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      log.info('Obteniendo nuevo token de Siigo...');
      
      const authUrl = 'https://api.siigo.com/auth';
      
      // Create basic auth header
      const authHeader = 'Basic ' + Buffer.from(
        `${process.env.SIIGO_USERNAME}:${process.env.SIIGO_ACCESS_KEY}`
      ).toString('base64');

      // Add debug logging
      log.info('Sending request to:', authUrl);

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: { 
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: process.env.SIIGO_USERNAME,
          access_key: process.env.SIIGO_ACCESS_KEY,
          ...(process.env.SIIGO_PARTNER_ID && { partner_id: process.env.SIIGO_PARTNER_ID })
        })
      });

      log.info('Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      const token = data?.access_token;
      const expiresIn = Number(data?.expires_in || 3600);
      
      if (!token) throw new Error('No se recibió token en la respuesta');

      cachedToken = token;
      cachedTokenExpiry = now + (expiresIn - 300) * 1000;
      
      log.info(`Token obtenido exitosamente. Expira en ${expiresIn} segundos`);
      return token;
      
    } catch (err) {
      const error = err as Error;
      log.error('Error obteniendo token:', error.message);
      throw error;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

async function callSiigoAPI(url: string, token: string): Promise<Response> {
  return fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
}

function extractPurchases(data: unknown): Purchase[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Purchase[];
  
  const typedData = data as Record<string, unknown>;
  const results = typedData.results as Purchase[] | undefined;
  const dataArray = typedData.data as Purchase[] | undefined;
  const purchases = typedData.purchases as Purchase[] | undefined;
  const items = typedData.items as Purchase[] | undefined;
  
  return results || dataArray || purchases || items || [];
}

function extractPagination(data: SiigoResponse<unknown>) {
  const pagination = data?.pagination || data?.meta || {};
  return {
    currentPage: Number(pagination.page || 1),
    pageSize: Number(pagination.page_size || PAGE_SIZE_DEFAULT),
    totalResults: Number(pagination.total_results || pagination.total || 0),
    totalPages: Math.ceil((pagination.total_results || pagination.total || 0) / (pagination.page_size || PAGE_SIZE_DEFAULT))
  };
}

/**
 * Extrae fecha de una factura con múltiples estrategias
 */
function extractInvoiceDate(invoice: Purchase | null | undefined): Date | null {
  if (!invoice) return null;

  const dateFields = [
    invoice.date,
    invoice.issue_date,
    invoice.issueDate,
    invoice.fecha,
    invoice.fecha_emision,
    invoice.created_at,
    invoice.updated_at,
    invoice.metadata?.created,
    invoice.metadata?.created_at,
    invoice.metadata?.date,
    invoice.document?.date,
    invoice.document?.fecha,
    invoice.document?.issue_date,
    invoice.timestamp,
    invoice.datetime,
    invoice.created,
    invoice.emitted_at
  ];

  for (const field of dateFields) {
    if (!field) continue;
    
    try {
      if (field instanceof Date) return field;
      
      if (typeof field === 'number') {
        const date = new Date(field < 1e12 ? field * 1000 : field);
        if (!isNaN(date.getTime())) return date;
      }
      
      if (typeof field === 'string') {
        const date = new Date(field);
        if (!isNaN(date.getTime())) return date;
      }
    } catch (_e) {
      continue;
    }
  }

  return null;
}

/**
 * Analiza las facturas obtenidas para generar diagnósticos
 */
interface PurchaseAnalysis {
  monthlyBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  dateRanges: { min: string; max: string };
  sampleInvoices: Array<{
    id: string | number;
    date: string;
    status: string;
    amount: string | number;
    rawData: string[];
  }>;
  issues: {
    missingDates: number;
    wrongYear: number;
    totalAnalyzed: number;
  };
  missingDates: number;
  wrongYear: number;
}

function analyzePurchases(purchases: Purchase[], year: number): PurchaseAnalysis {
  const monthlyBreakdown: Record<string, number> = {};
  const statusBreakdown: Record<string, number> = {};
  const dateRanges: { min?: Date; max?: Date } = {};
  const sampleInvoices: Partial<Purchase>[] = [];
  let missingDates = 0;
  let wrongYear = 0;

  // Inicializar meses
  for (let i = 1; i <= 12; i++) {
    const month = i.toString().padStart(2, '0');
    monthlyBreakdown[`${year}-${month}`] = 0;
  }

  purchases.forEach((purchase) => {
    // Analizar fecha
    const date = extractInvoiceDate(purchase);
    if (date) {
      const invoiceYear = date.getFullYear();
      const month = `${invoiceYear}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (invoiceYear === year) {
        monthlyBreakdown[month] = (monthlyBreakdown[month] || 0) + 1;
      } else {
        wrongYear++;
      }

      // Rango de fechas
      if (!dateRanges.min || date < dateRanges.min) dateRanges.min = date;
      if (!dateRanges.max || date > dateRanges.max) dateRanges.max = date;
    } else {
      missingDates++;
    }

    // Analizar estado
    const status = String(
      (purchase as Record<string, unknown>).status || 
      (purchase as Record<string, unknown>).state || 
      (purchase as Record<string, unknown>).document_status || 
      'unknown'
    );
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

    // Guardar muestras (máximo 5)
    if (sampleInvoices.length < 5) {
      const purchaseRecord = purchase as Record<string, unknown>;
      sampleInvoices.push({
        id: String(purchase.id || purchaseRecord.number || sampleInvoices.length),
        date: date?.toISOString() || 'NO_DATE',
        status: status,
        amount: purchaseRecord.total || purchaseRecord.amount || 'NO_AMOUNT',
        rawData: Object.keys(purchase).slice(0, 10) // Primeros 10 campos
      });
    }
  });

  const result: PurchaseAnalysis = {
    monthlyBreakdown,
    statusBreakdown,
    dateRanges: {
      min: dateRanges.min?.toISOString() || 'N/A',
      max: dateRanges.max?.toISOString() || 'N/A'
    },
    sampleInvoices: sampleInvoices as Array<{
      id: string | number;
      date: string;
      status: string;
      amount: string | number;
      rawData: string[];
    }>,
    issues: {
      missingDates,
      wrongYear,
      totalAnalyzed: purchases.length
    },
    missingDates,
    wrongYear
  };

  return result;
}

/**
 * Prueba múltiples configuraciones de filtros para encontrar facturas faltantes
 */
// ... rest of the code remains the same ...
// Prefix with underscore to indicate intentionally unused
async function _testMultipleFilters(year: number, token: string) {
  const tests = [
    {
      name: 'Sin filtros de fecha',
      params: { page: 1, page_size: 10 }
    },
    {
      name: 'Solo año',
      params: { page: 1, page_size: 10, year: year }
    },
    {
      name: 'Fechas específicas',
      params: { page: 1, page_size: 10, start_date: `${year}-01-01`, end_date: `${year}-12-31` }
    },
    {
      name: 'Primer trimestre',
      params: { page: 1, page_size: 10, start_date: `${year}-01-01`, end_date: `${year}-03-31` }
    },
    {
      name: 'Con estado activo',
      params: { page: 1, page_size: 10, start_date: `${year}-01-01`, end_date: `${year}-12-31`, status: 'active' }
    },
    {
      name: 'Con estado aprobado',
      params: { page: 1, page_size: 10, start_date: `${year}-01-01`, end_date: `${year}-12-31`, status: 'approved' }
    }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const url = new URL(`${SIIGO_BASE}/purchases`);
      Object.entries(test.params).forEach(([key, value]) => {
        url.searchParams.set(key, value.toString());
      });

      log.info(`Probando: ${test.name} - ${url.toString()}`);
      
      const response = await callSiigoAPI(url.toString(), token);
      
      if (response.ok) {
        const data = await response.json();
        const items = extractPurchases(data);
        const pagination = extractPagination(data);
        
        results.push({
          test: test.name,
          totalFound: pagination.totalResults,
          itemsInPage: items.length,
          sampleItem: items[0] || null,
          url: url.toString()
        });
      } else {
        results.push({
          test: test.name,
          error: `HTTP ${response.status}`,
          url: url.toString()
        });
      }

      await sleep(500); // Evitar rate limits
    } catch (err) {
      const error = err as Error;
      results.push({
        test: test.name,
        error: error.message,
        url: 'N/A'
      });
    }
  }

  return results.map(result => ({
    test: result.test,
    error: result.error,
    url: result.url
  }));
}

async function fetchPageWithRetry(
  pageNum: number, 
  year: number, 
  pageSize: number, 
  token: string, 
  filters: PurchaseFilters = {}, 
  maxRetries = 3
): Promise<SiigoResponse<Purchase>> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  
  const url = new URL(`${SIIGO_BASE}/purchases`);
  url.searchParams.set('page', pageNum.toString());
  url.searchParams.set('page_size', pageSize.toString());
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  
  // Agregar filtros adicionales
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.debug(`Página ${pageNum} - Intento ${attempt}`);
      
      let response = await callSiigoAPI(url.toString(), token);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * attempt;
        log.warn(`Rate limit en página ${pageNum}. Esperando ${waitTime}ms`);
        await sleep(waitTime);
        response = await callSiigoAPI(url.toString(), token);
      }

      if (response.status === 401) {
        throw new Error('Token expirado - necesita renovación');
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return await response.json();
      
    } catch (err) {
      const error = err as Error;
      lastError = error;
      log.warn(`Error en página ${pageNum}, intento ${attempt}:`, error.message);
      
      if (attempt < maxRetries) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError || new Error(`No se pudo obtener la página ${pageNum} después de ${maxRetries} intentos`);
}

function getCacheKey(year: number, pageSize: number, filters: Record<string, unknown> = {}): string {
  const filtersStr = Object.keys(filters).length > 0 ? JSON.stringify(filters) : '';
  return `purchases_${year}_${pageSize}_${filtersStr}`;
}

async function fetchAllPurchasesWithDiagnostics(
  year: number, 
  pageSize: number = 100, 
  additionalFilters: PurchaseFilters = {}
): Promise<PurchaseDiagnostics> {
  const token = await getSiigoToken();
  let allPurchases: Purchase[] = [];
  let totalPages = 1;
  let totalFromAPI = 0;
  
  // Intento obtener datos de la caché primero
  const cacheKey = getCacheKey(year, pageSize, additionalFilters);
  const cachedData = purchasesCache.get(cacheKey);
  
  if (cachedData && (Date.now() - cachedData.ts < CACHE_TTL_MS)) {
    log.info(`Usando datos en caché para ${cacheKey}`);
    return {
      purchases: cachedData.data,
      pagesFetched: cachedData.pagesFetched,
      totalFromAPI: cachedData.totalFromAPI,
      diagnostics: {
        monthlyBreakdown: cachedData.monthlyBreakdown,
        statusBreakdown: cachedData.statusBreakdown,
        ...cachedData.diagnostics
      }
    };
  }
  
  // Si no hay caché o está expirada, obtener datos de la API
  log.info(`Obteniendo compras para el año ${year} con filtros:`, additionalFilters);
  
  try {
    // Obtener la primera página para saber el total de páginas
    const firstPage = await fetchPageWithRetry(1, year, pageSize, token, additionalFilters);
    totalPages = firstPage.pagination?.page || 1;
    totalFromAPI = firstPage.pagination?.total || 0;
    
    // Procesar la primera página
    const firstPagePurchases = extractPurchases(firstPage);
    allPurchases = [...firstPagePurchases];
    
    // Obtener las páginas restantes en paralelo
    const pagePromises: Array<Promise<SiigoResponse<Purchase>>> = [];
    
    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(fetchPageWithRetry(page, year, pageSize, token, additionalFilters));
    }
    
    const pages = await Promise.all(pagePromises);
    
    // Procesar las páginas restantes
    pages.forEach((page) => {
      const pagePurchases = extractPurchases(page);
      allPurchases = [...allPurchases, ...pagePurchases];
    });
    
    // Realizar análisis de las compras
    const analysis = analyzePurchases(allPurchases, year);
    
    // Generar recomendaciones
    const recommendations: string[] = [];
    if (analysis.issues.missingDates > 0) {
      recommendations.push(`Advertencia: ${analysis.issues.missingDates} compras sin fecha válida`);
    }
    if (analysis.issues.wrongYear > 0) {
      recommendations.push(`Advertencia: ${analysis.issues.wrongYear} compras no son del año ${year}`);
    }
    
    // Crear entrada de caché
    const cacheEntry: CacheEntry = {
      ts: Date.now(),
      data: allPurchases,
      pagesFetched: totalPages,
      totalFromAPI,
      monthlyBreakdown: analysis.monthlyBreakdown,
      statusBreakdown: analysis.statusBreakdown,
      diagnostics: {
        analysis,
        recommendations
      }
    };
    
    // Actualizar caché
    purchasesCache.set(cacheKey, cacheEntry);
    
    // Devolver resultados con diagnósticos
    return {
      purchases: allPurchases,
      pagesFetched: totalPages,
      totalFromAPI,
      diagnostics: {
        analysis,
        recommendations,
        testResults: [],
        requestedFilters: additionalFilters,
        apiEndpoint: `${SIIGO_BASE}/purchases`,
        monthlyBreakdown: analysis.monthlyBreakdown,
        statusBreakdown: analysis.statusBreakdown,
        dateRanges: {
          min: analysis.dateRanges.min ? new Date(analysis.dateRanges.min) : undefined,
          max: analysis.dateRanges.max ? new Date(analysis.dateRanges.max) : undefined
        },
        sampleInvoices: analysis.sampleInvoices as Partial<Purchase>[],
        issues: {
          missingDates: analysis.issues.missingDates,
          wrongYear: analysis.issues.wrongYear,
          totalAnalyzed: analysis.issues.totalAnalyzed
        }
      }
    };
    
  } catch (error) {
    const err = error as Error;
    log.error('Error en fetchAllPurchasesWithDiagnostics:', err.message);
    throw error;
  }
}

export async function GET() {
  try {
    // Get the token using the existing getSiigoToken function
    const token = await getSiigoToken();
    
    // Return the token in the expected format
    return NextResponse.json({ 
      success: true,
      token: token,
      expires_in: 3600 // 1 hour in seconds
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error getting Siigo token:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get Siigo token',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}