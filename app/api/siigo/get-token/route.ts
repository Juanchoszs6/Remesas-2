// app/api/siigo/get-purchases/route.ts
import { NextResponse } from 'next/server';

const SIIGO_BASE = (process.env.SIIGO_BASE_URL || 'https://api.siigo.com/v1').replace(/\/$/, '');
const SIIGO_AUTH = (process.env.SIIGO_AUTH_URL || 'https://api.siigo.com/auth').replace(/\/$/, '');

const CACHE_DURATION_MS = 10 * 60 * 1000;
const PAGE_SIZE_DEFAULT = 50;
const THROTTLE_BETWEEN_PAGES_MS = 300;
const MAX_SERVER_PAGES = 100;

interface CacheEntry {
  ts: number;
  data: any[];
  pagesFetched: number;
  totalFromAPI: number;
  monthlyBreakdown?: Record<string, number>;
  statusBreakdown?: Record<string, number>;
  diagnostics?: any;
}

let cachedToken: string | null = null;
let cachedTokenExpiry = 0;
let tokenPromise: Promise<string> | null = null;
const purchasesCache = new Map<string, CacheEntry>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const log = {
  debug: (...args: any[]) => console.debug('[siigo-diagnostic]', ...args),
  info: (...args: any[]) => console.info('[siigo-diagnostic]', ...args),
  warn: (...args: any[]) => console.warn('[siigo-diagnostic]', ...args),
  error: (...args: any[]) => console.error('[siigo-diagnostic]', ...args)
};

async function getSiigoToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) return cachedToken;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      log.info('Obteniendo nuevo token de Siigo...');
      
      const body: any = {
        username: process.env.SIIGO_USERNAME,
        access_key: process.env.SIIGO_ACCESS_KEY
      };
      
      if (process.env.SIIGO_PARTNER_ID) {
        body.partner_id = process.env.SIIGO_PARTNER_ID;
      }

      const response = await fetch(SIIGO_AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

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
      
    } catch (error: any) {
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

function extractPurchases(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results || data.data || data.purchases || data.items || [];
}

function extractPagination(data: any) {
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
function extractInvoiceDate(invoice: any): Date | null {
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
    } catch (e) {
      continue;
    }
  }

  return null;
}

/**
 * Analiza las facturas obtenidas para generar diagnósticos
 */
function analyzePurchases(purchases: any[], year: number) {
  const monthlyBreakdown: Record<string, number> = {};
  const statusBreakdown: Record<string, number> = {};
  const dateRanges: { min?: Date; max?: Date } = {};
  const sampleInvoices: any[] = [];
  let missingDates = 0;
  let wrongYear = 0;

  // Inicializar meses
  for (let i = 1; i <= 12; i++) {
    const month = i.toString().padStart(2, '0');
    monthlyBreakdown[`${year}-${month}`] = 0;
  }

  purchases.forEach((purchase, index) => {
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
    const status = purchase.status || purchase.state || purchase.document_status || 'unknown';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

    // Guardar muestras
    if (index < 5) {
      sampleInvoices.push({
        id: purchase.id || purchase.number || index,
        date: date?.toISOString() || 'NO_DATE',
        status: status,
        amount: purchase.total || purchase.amount || 'NO_AMOUNT',
        rawData: Object.keys(purchase).slice(0, 10) // Primeros 10 campos
      });
    }
  });

  return {
    monthlyBreakdown,
    statusBreakdown,
    dateRanges: {
      min: dateRanges.min?.toISOString() || 'N/A',
      max: dateRanges.max?.toISOString() || 'N/A'
    },
    sampleInvoices,
    issues: {
      missingDates,
      wrongYear,
      totalAnalyzed: purchases.length
    }
  };
}

/**
 * Prueba múltiples configuraciones de filtros para encontrar facturas faltantes
 */
async function testMultipleFilters(year: number, token: string) {
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
    } catch (error: any) {
      results.push({
        test: test.name,
        error: error.message,
        url: 'N/A'
      });
    }
  }

  return results;
}

async function fetchPageWithRetry(pageNum: number, year: number, pageSize: number, token: string, filters: any = {}, maxRetries = 3): Promise<any> {
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
      url.searchParams.set(key, value.toString());
    }
  });

  let lastError: any = null;

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

      const data = await response.json();
      return data;

    } catch (error: any) {
      lastError = error;
      log.warn(`Error en página ${pageNum}, intento ${attempt}:`, error.message);
      
      if (attempt < maxRetries) {
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError;
}

async function fetchAllPurchasesWithDiagnostics(year: number, pageSize: number = PAGE_SIZE_DEFAULT, additionalFilters: any = {}): Promise<{ purchases: any[], pagesFetched: number, totalFromAPI: number, diagnostics: any }> {
  let token = await getSiigoToken();
  let allPurchases: any[] = [];
  let pagesFetched = 0;
  let totalFromAPI = 0;

  log.info(`=== INICIANDO OBTENCIÓN DIAGNÓSTICA DEL AÑO ${year} ===`);

  try {
    // Primero, probar diferentes configuraciones
    const filterTests = await testMultipleFilters(year, token);
    log.info('Resultados de pruebas de filtros:', filterTests);

    // Obtener primera página
    const firstPageData = await fetchPageWithRetry(1, year, pageSize, token, additionalFilters);
    pagesFetched++;

    const firstPagePurchases = extractPurchases(firstPageData);
    allPurchases.push(...firstPagePurchases);

    const paginationInfo = extractPagination(firstPageData);
    totalFromAPI = paginationInfo.totalResults;
    const totalPages = paginationInfo.totalPages;

    log.info(`Primera página obtenida:`);
    log.info(`- Items en página: ${firstPagePurchases.length}`);
    log.info(`- Total en API: ${totalFromAPI}`);
    log.info(`- Total páginas: ${totalPages}`);

    // Obtener páginas restantes
    if (totalPages > 1) {
      const pagesToFetch = Math.min(totalPages, MAX_SERVER_PAGES);
      
      for (let page = 2; page <= pagesToFetch; page++) {
        try {
          const pageData = await fetchPageWithRetry(page, year, pageSize, token, additionalFilters);
          pagesFetched++;

          const pagePurchases = extractPurchases(pageData);
          allPurchases.push(...pagePurchases);

          if (page % 10 === 0) {
            log.info(`Progreso: ${page}/${pagesToFetch} páginas | ${allPurchases.length} compras obtenidas`);
          }

          if (page < pagesToFetch) {
            await sleep(THROTTLE_BETWEEN_PAGES_MS);
          }

        } catch (error: any) {
          if (error.message.includes('Token expirado')) {
            log.warn(`Token expirado en página ${page}, renovando...`);
            cachedToken = null;
            cachedTokenExpiry = 0;
            token = await getSiigoToken();
            
            const retryData = await fetchPageWithRetry(page, year, pageSize, token, additionalFilters);
            pagesFetched++;
            
            const retryPurchases = extractPurchases(retryData);
            allPurchases.push(...retryPurchases);
          } else {
            log.error(`Error crítico en página ${page}:`, error.message);
            break;
          }
        }
      }
    }

    // Analizar resultados
    const analysis = analyzePurchases(allPurchases, year);

    const diagnostics = {
      filterTests,
      analysis,
      apiEndpoint: `${SIIGO_BASE}/purchases`,
      requestedFilters: {
        year,
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        ...additionalFilters
      },
      recommendations: [] as string[]
    };

    // Generar recomendaciones
    if (analysis.issues.missingDates > 0) {
      diagnostics.recommendations.push(`${analysis.issues.missingDates} facturas sin fecha válida - revisar campos de fecha`);
    }
    
    if (analysis.issues.wrongYear > 0) {
      diagnostics.recommendations.push(`${analysis.issues.wrongYear} facturas de años diferentes encontradas`);
    }

    const emptyMonths = Object.entries(analysis.monthlyBreakdown).filter(([_, count]) => count === 0);
    if (emptyMonths.length > 0) {
      diagnostics.recommendations.push(`Meses sin facturas: ${emptyMonths.map(([month]) => month).join(', ')}`);
    }

    // Sugerir filtros alternativos si hay pocos resultados
    if (totalFromAPI < 100) {
      diagnostics.recommendations.push('Pocos resultados - considera probar sin filtros de fecha o con filtros de estado');
    }

    log.info(`=== ANÁLISIS COMPLETADO ===`);
    log.info(`- Facturas obtenidas: ${allPurchases.length}`);
    log.info(`- Meses con datos: ${Object.values(analysis.monthlyBreakdown).filter(count => count > 0).length}/12`);
    log.info(`- Estados encontrados: ${Object.keys(analysis.statusBreakdown).join(', ')}`);

    return {
      purchases: allPurchases,
      pagesFetched,
      totalFromAPI,
      diagnostics
    };

  } catch (error: any) {
    log.error('Error fatal obteniendo compras:', error.message);
    throw error;
  }
}

function getCacheKey(year: number, pageSize: number, filters: any = {}): string {
  const filtersStr = Object.keys(filters).length > 0 ? JSON.stringify(filters) : '';
  return `purchases_${year}_${pageSize}_${filtersStr}`;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    
    const year = parseInt(url.searchParams.get('year') || '2025');
    const pageSize = parseInt(url.searchParams.get('page_size') || url.searchParams.get('per_page') || PAGE_SIZE_DEFAULT.toString());
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const debug = url.searchParams.get('debug') === 'true';
    const diagnose = url.searchParams.get('diagnose') === 'true';
    
    // Filtros adicionales para pruebas
    const additionalFilters: any = {};
    if (url.searchParams.get('status')) additionalFilters.status = url.searchParams.get('status');
    if (url.searchParams.get('type')) additionalFilters.type = url.searchParams.get('type');

    if (year < 2020 || year > 2030) {
      return NextResponse.json(
        { error: `Año inválido: ${year}. Debe estar entre 2020 y 2030` },
        { status: 400 }
      );
    }

    log.info(`Solicitud recibida: año=${year}, pageSize=${pageSize}, diagnose=${diagnose}`);

    const cacheKey = getCacheKey(year, pageSize, additionalFilters);
    const cached = purchasesCache.get(cacheKey);

    if (!forceRefresh && !diagnose && cached && (Date.now() - cached.ts) < CACHE_DURATION_MS) {
      log.info(`CACHE HIT - Devolviendo ${cached.data.length} compras del cache`);
      
      const response: any = {
        success: true,
        purchases: cached.data,
        count: cached.data.length,
        year,
        pagesFetched: cached.pagesFetched,
        totalFromAPI: cached.totalFromAPI,
        cached: true,
        processingTimeMs: Date.now() - startTime
      };

      if (debug && cached.diagnostics) {
        response.diagnostics = cached.diagnostics;
      }

      return NextResponse.json(response);
    }

    log.info(`Obteniendo datos ${diagnose ? 'con diagnóstico' : 'frescos'} de Siigo`);
    
    const result = await fetchAllPurchasesWithDiagnostics(year, pageSize, additionalFilters);

    const cacheEntry: CacheEntry = {
      ts: Date.now(),
      data: result.purchases,
      pagesFetched: result.pagesFetched,
      totalFromAPI: result.totalFromAPI,
      diagnostics: result.diagnostics
    };
    purchasesCache.set(cacheKey, cacheEntry);

    const response: any = {
      success: true,
      purchases: result.purchases,
      count: result.purchases.length,
      year,
      pagesFetched: result.pagesFetched,
      totalFromAPI: result.totalFromAPI,
      cached: false,
      processingTimeMs: Date.now() - startTime
    };

    if (debug || diagnose) {
      response.diagnostics = result.diagnostics;
    }

    if (diagnose) {
      response.monthlyBreakdown = result.diagnostics.analysis.monthlyBreakdown;
      response.statusBreakdown = result.diagnostics.analysis.statusBreakdown;
      response.recommendations = result.diagnostics.recommendations;
    }

    log.info(`Respuesta enviada: ${result.purchases.length}/${result.totalFromAPI} compras`);

    return NextResponse.json(response);

  } catch (error: any) {
    log.error('Error en GET handler:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Error interno del servidor',
        processingTimeMs: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}