import { NextResponse } from 'next/server';
import { obtenerTokenSiigo } from '@/lib/siigo/auth';
import { InvoiceType } from '@/types/invoice';

// Ensure required environment variables are set
if (!process.env.SIIGO_PARTNER_ID) {
  console.error('Error: SIIGO_PARTNER_ID environment variable is not set');
  throw new Error('Configuration error: Missing Siigo Partner ID');
}

interface SiigoDocumentType {
  id: number;
  code: string;
  name: string;
  description: string;
  type: 'FC' | 'ND' | 'DS' | 'RP';
  active: boolean;
  // ... other fields as needed
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'FC,ND,DS,RP'; // Default to all types if none specified
    
    const token = await obtenerTokenSiigo();
    if (!token) {
      return NextResponse.json(
        { error: 'No se pudo autenticar con Siigo' },
        { status: 401 }
      );
    }

    // Fetch document types for the specified type
    const siigoUrl = new URL(`https://api.siigo.com/v1/document-types?type=${type}`);
    const response = await fetch(siigoUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Partner-Id': process.env.SIIGO_PARTNER_ID || '',
      },
      cache: 'no-store', // Prevent Next.js from caching the response
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response from Siigo:', errorData);
      throw new Error(
        `Error al obtener tipos de factura: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    
    // Transform the response to match our interface
    const documentTypes = data.map((doc: any) => ({
      id: doc.id.toString(),
      code: doc.code,
      name: doc.name,
      type: doc.type,
      description: doc.description,
      active: doc.active
    }));
    
    return NextResponse.json(documentTypes);
    
    return NextResponse.json(documentTypes);
  } catch (error) {
    console.error('Error en la API de tipos de factura:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener los tipos de factura',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
