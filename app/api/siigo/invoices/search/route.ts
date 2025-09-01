import { NextResponse } from 'next/server';
import { obtenerTokenSiigo } from '@/lib/siigo/auth';
import { Invoice } from '@/types/invoice';

// Ensure required environment variables are set
if (!process.env.SIIGO_PARTNER_ID) {
  console.error('Error: SIIGO_PARTNER_ID environment variable is not set');
  throw new Error('Configuration error: Missing Siigo Partner ID');
}

interface SearchParams {
  startDate?: string;
  endDate?: string;
  typeId?: string;
  limit?: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const typeId = searchParams.get('typeId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const token = await obtenerTokenSiigo();
    if (!token) {
      return NextResponse.json(
        { error: 'No se pudo autenticar con Siigo' },
        { status: 401 }
      );
    }

    // Construir la URL de la API de Siigo con los parámetros de búsqueda
    const url = new URL('https://api.siigo.com/v1/invoices');
    const params = new URLSearchParams();
    
    if (startDate) params.append('created_start', startDate);
    if (endDate) params.append('created_end', endDate);
    if (typeId) params.append('document_type', typeId);
    params.append('page_size', limit.toString());
    
    url.search = params.toString();

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': process.env.SIIGO_PARTNER_ID || '',
      },
      cache: 'no-store', // Prevent Next.js from caching the response
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error response from Siigo:', errorData);
      throw new Error(
        `Error al buscar facturas: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return NextResponse.json(data.results || []);
  } catch (error) {
    console.error('Error en la búsqueda de facturas:', error);
    return NextResponse.json(
      { 
        error: 'Error al buscar facturas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
