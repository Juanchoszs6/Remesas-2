// Tipos de documentos soportados por la API de Siigo
export type TipoDocumentoSiigo = 'FC' | 'ND' | 'DS' | 'RP';

// Interfaz para el tipo de documento de Siigo
export interface DocumentTypeSiigo {
  id: number;
  code: string;
  name: string;
  description: string;
  type: TipoDocumentoSiigo;
  active: boolean;
  cost_center: boolean;
  cost_center_mandatory: boolean;
  automatic_number: boolean;
  consecutive: number;
  decimals: boolean;
  consumption_tax: boolean;
  reteiva: boolean;
  reteica: boolean;
  document_support: boolean;
}

// Estados de documento
export type EstadoDocumento = 'draft' | 'open' | 'paid' | 'voided' | 'pending';

// Interfaz para los filtros de búsqueda
export interface FiltrosFactura {
  fechaInicio?: string; // Formato YYYY-MM-DD
  fechaFin?: string;     // Formato YYYY-MM-DD
  clienteId?: string;
  estado?: EstadoDocumento | string;
  vendedorId?: string;
  ordenarPor?: 'fecha' | 'numero' | 'total' | 'fecha_vencimiento';
  orden?: 'asc' | 'desc';
  pagina?: number;
  porPagina?: number;
  textoBusqueda?: string; // Búsqueda general
}

// Respuesta paginada estándar
export interface RespuestaPaginada<T> {
  success: boolean;
  data: T[];
  paginacion: {
    pagina: number;
    porPagina: number;
    total: number;
    totalPaginas: number;
  };
  error?: string;
}

// URL base de la API de Siigo
export const SIIGO_API_BASE_URL = 'https://api.siigo.com/v1';

// Endpoints de la API de Siigo
export const SIIGO_API_ENDPOINTS = {
  TIPOS_DOCUMENTO: '/document-types',
  FACTURAS: '/invoices',
  // Agregar más endpoints según sea necesario
} as const;

// Tipo para los parámetros de consulta de la API de Siigo
export interface SiigoQueryParams {
  type?: TipoDocumentoSiigo;
  page?: number;
  page_size?: number;
  [key: string]: string | number | undefined;
}

// Tipo para los headers de la API de Siigo
export interface SiigoApiHeaders {
  'Authorization': string;
  'Content-Type'?: string;
  'Partner-Id'?: string;
}

// Interfaz para la respuesta de la API de Siigo
export interface SiigoApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// Interfaz para la respuesta paginada de la API de Siigo
export interface SiigoPagedResponse<T> {
  pagination: {
    page: number;
    page_size: number;
    total_results: number;
    total_pages: number;
  };
  results: T[];
}
