import { NextResponse } from 'next/server';
import { obtenerTokenSiigo } from '@/lib/siigo/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('type') || 'FC';
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '50';

    // Get the Siigo API token
    const token = await obtenerTokenSiigo();
    if (!token) {
      return NextResponse.json(
        { error: 'No se pudo obtener el token de autenticación' },
        { status: 401 }
      );
    }

    // Get Partner ID from environment variables
    const partnerId = process.env.SIIGO_PARTNER_ID;
    if (!partnerId) {
      throw new Error('SIIGO_PARTNER_ID is not configured');
    }

    // First, get the document type ID
    const docTypesUrl = new URL('https://api.siigo.com/v1/document-types');
    docTypesUrl.searchParams.append('type', documentType);
    
    const docTypesResponse = await fetch(docTypesUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': partnerId
      }
    });
    
    if (!docTypesResponse.ok) {
      const errorData = await docTypesResponse.json().catch(() => ({}));
      console.error('Error fetching document types:', errorData);
      throw new Error('Error al obtener los tipos de documento');
    }
    
    const docTypes = await docTypesResponse.json();
    if (!Array.isArray(docTypes) || docTypes.length === 0) {
      throw new Error('No se encontraron tipos de documento');
    }
    
    // Get the first document type ID
    const docTypeId = docTypes[0].id;
    
    // Now fetch the actual invoices
    const baseUrl = 'https://api.siigo.com/v1/invoices';
    const url = new URL(baseUrl);
    
    // Add query parameters
    url.searchParams.append('document_type_id', docTypeId.toString());
    url.searchParams.append('page', page);
    url.searchParams.append('page_size', pageSize);
    
    // Add date range if needed
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate) url.searchParams.append('created_start', startDate);
    if (endDate) url.searchParams.append('created_end', endDate);


    // Make the request to Siigo API
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': partnerId
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error from Siigo API:', errorData);
      return NextResponse.json(
        { error: 'Error al obtener los documentos', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Log the response for debugging
    console.log('Siigo API response:', JSON.stringify(data, null, 2));
    
    // Return the data in a consistent format
    return NextResponse.json({
      success: true,
      data: Array.isArray(data) ? data : (data.results || data.data || [])
    });

  } catch (error) {
    console.error('Error in /api/siigo/documents:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
