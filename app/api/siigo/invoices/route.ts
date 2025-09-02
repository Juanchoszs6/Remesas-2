import { NextResponse } from 'next/server';
import { obtenerFacturasSiigo } from '@/lib/siigo/facturas';

// Mapeo de tipos de documento a sus respectivos códigos y endpoints
const DOCUMENT_CONFIG = {
  // Facturas
  '1': { 
    code: 'FAC', 
    name: 'FACTURA',
    endpoint: 'invoices',
    param: 'document.id'
  },
  // Notas de Crédito
  '2': { 
    code: 'NCE', 
    name: 'NOTA_CREDITO',
    endpoint: 'credit-notes',
    param: 'document.type'
  },
  // Notas de Débito
  '3': { 
    code: 'NDE', 
    name: 'NOTA_DEBITO',
    endpoint: 'debit-notes',
    param: 'document.type'
  },
  // Documentos de Soporte
  '4': { 
    code: 'DS', 
    name: 'DOCUMENTO_SOPORTE',
    endpoint: 'support-documents',
    param: 'document.type'
  },
  // Recibos de Pago
  '5': { 
    code: 'RP', 
    name: 'RECIBO_PAGO',
    endpoint: 'payment-receipts',
    param: 'document.type'
  }
} as const;

type DocumentTypeKey = keyof typeof DOCUMENT_CONFIG;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as DocumentTypeKey;
    
    // Validar tipo de documento
    if (!type || !DOCUMENT_CONFIG[type]) {
      return NextResponse.json({
        error: 'Tipo de documento inválido',
        validTypes: Object.entries(DOCUMENT_CONFIG).map(([key, value]) => ({
          id: key,
          code: value.code,
          name: value.name,
          endpoint: value.endpoint
        }))
      }, { status: 400 });
    }

    const config = DOCUMENT_CONFIG[type];
    
    // Preparar parámetros
    const params = {
      pagina: parseInt(searchParams.get('page') || '1'),
      porPagina: parseInt(searchParams.get('pageSize') || '20'),
      fechaInicio: searchParams.get('startDate') || undefined,
      fechaFin: searchParams.get('endDate') || undefined,
      clienteId: searchParams.get('customerId') || undefined,
      estado: searchParams.get('status') || undefined,
      textoBusqueda: searchParams.get('search') || undefined,
      ordenarPor: searchParams.get('sortBy') || 'date',
      orden: (searchParams.get('sortOrder') || 'desc').toLowerCase() as 'asc' | 'desc'
    };

    // Obtener los datos
    const result = await obtenerFacturasSiigo(config.name as any, {
      ...params,
      tipoDocumento: config.name,
      endpoint: config.endpoint,
      paramTipo: config.param
    });

    // Manejar errores
    if (!result.success) {
      const status = result.error?.includes('404') ? 404 : 500;
      return NextResponse.json({
        success: false,
        error: result.error || `Error al obtener ${config.name.toLowerCase()}s`,
        type: config.name,
        code: config.code
      }, { status });
    }

    // Retornar respuesta exitosa
    return NextResponse.json({
      success: true,
      type: config.name,
      code: config.code,
      data: result.data || [],
      pagination: result.paginacion || {
        page: params.pagina,
        pageSize: params.porPagina,
        total: 0,
        totalPages: 0
      }
    });

  } catch (error: any) {
    console.error('Error en la API de facturas:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
    const statusCode = errorMessage.includes('404') ? 404 : 500;
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: statusCode });
  }
}
