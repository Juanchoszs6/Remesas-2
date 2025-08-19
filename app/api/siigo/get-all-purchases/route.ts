import { NextResponse } from 'next/server';
import { SiigoPurchaseInvoice, fetchAllPages } from '@/lib/siigo/api';
import { obtenerTokenSiigo } from '../auth/route';

export async function GET(request: Request) {
  // Obtener el token de autenticación directamente
  const authToken = await obtenerTokenSiigo();
  
  if (!authToken) {
    return NextResponse.json(
      { error: 'No se pudo autenticar con Siigo' },
      { status: 401 }
    );
  }

  try {
    // Configurar el cliente HTTP con el token
    const siigoApiUrl = process.env.SIIGO_API_URL || 'https://api.siigo.com/v1';
    
    // Fetch all purchase invoices with pagination
    const allInvoices = await fetchAllPages<SiigoPurchaseInvoice>(
      '/purchases',
      authToken,
      30 // Reducir el tamaño de página para mejor rendimiento
    );
    
    if (!allInvoices || allInvoices.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // Process and normalize the data
    const processedInvoices = await Promise.all(allInvoices.map(async (invoice) => {
      // Try to get supplier details if we have an ID but missing name
      let supplierName = invoice.supplier?.name;
      let supplierId = invoice.supplier?.id;
      let supplierIdentification = invoice.supplier?.identification || '';
      
      // If we have supplier ID but no name, try to fetch supplier details
      if (supplierId && !supplierName) {
        try {
          const supplierResponse = await fetch(`${siigoApiUrl}/suppliers/${supplierId}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes',
            },
          });
          
          if (supplierResponse.ok) {
            const supplierData = await supplierResponse.json();
            supplierName = supplierData.name || '';
            supplierIdentification = supplierData.identification_number || supplierIdentification;
          }
        } catch (error) {
          console.error('Error fetching supplier details:', error);
        }
      }
      
      // Determine the best name to show
      const displayName = supplierName || 
                         (supplierIdentification ? `Proveedor ${supplierIdentification}` : 'Proveedor no especificado');
      
      return {
        id: invoice.id,
        number: invoice.number,
        prefix: invoice.prefix,
        date: invoice.date,
        due_date: invoice.due_date,
        status: invoice.status,
        subtotal: invoice.subtotal || 0,
        tax: invoice.tax || 0,
        total: invoice.total || 0,
        balance: invoice.balance || 0,
        currency: invoice.currency || { code: 'COP' },
        supplier: {
          id: supplierId,
          identification: supplierIdentification,
          name: displayName,
          branch_office: invoice.supplier?.branch_office || 0,
          original_name: supplierName, // Keep original name if available
        },
        items: (invoice.items || []).map((item) => ({
          id: item.id || '',
          code: item.code || '',
          description: item.description || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          discount: item.discount ? {
            percentage: item.discount.percentage,
            value: item.discount.value,
          } : undefined,
          taxes: (item.taxes || []).map((tax) => ({
            id: tax.id,
            name: tax.name || '',
            type: tax.type || '',
            percentage: tax.percentage || 0,
            value: tax.value || 0,
          })),
          total: item.total || 0,
        })),
        payments: (invoice.payments || []).map((payment) => ({
          id: payment.id,
          name: payment.name || '',
          value: payment.value || 0,
          due_date: payment.due_date,
        })),
        observations: invoice.observations,
        document_type: invoice.document_type || 'FC',
        document_number: invoice.document_number || invoice.number,
        created_at: invoice.created_at || new Date().toISOString(),
        updated_at: invoice.updated_at || new Date().toISOString(),
        metadata: {
          created: invoice.created_at || new Date().toISOString(),
          last_updated: invoice.updated_at || new Date().toISOString(),
        },
      };
    }));

    // Sort by date (newest first)
    processedInvoices.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Ordenar por fecha (más recientes primero)
    const sortedInvoices = processedInvoices.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return NextResponse.json(sortedInvoices, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60'
      }
    });
    
  } catch (error) {
    console.error('Error al obtener facturas de compra:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
