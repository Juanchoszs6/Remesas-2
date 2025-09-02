import { NextRequest, NextResponse } from 'next/server';
import { getSiigoToken } from '@/app/api/siigo/obtener-token/route';
import { getDocumentTypes, getAllDocumentTypes } from '@/lib/siigo/document-types';
import { SiigoApiError } from '@/lib/siigo/api';

export async function GET(request: NextRequest) {
  try {
    // Obtener el token de autenticación
    const token = await getSiigoToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No se pudo obtener el token de autenticación' },
        { status: 401 }
      );
    }

    // Obtener parámetros de consulta
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'FC' | 'ND' | 'DS' | 'RP' | null;
    const partnerId = searchParams.get('partnerId') || undefined;

    let result;
    
    if (type) {
      // Obtener un tipo específico de documento
      result = await getDocumentTypes(token, type, partnerId);
    } else {
      // Obtener todos los tipos de documentos
      result = await getAllDocumentTypes(token, partnerId);
    }

    // Verificar si hubo un error
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 500 }
      );
    }

    // Retornar los datos exitosamente
    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error en /api/siigo/document-types:', error);
    
    if (error instanceof SiigoApiError) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: typeof error.code === 'number' ? error.code : 500 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}

// Configuración de la ruta
export const dynamic = 'force-dynamic'; // Asegura que se ejecute en cada petición
export const revalidate = 0; // Evita el cacheo de respuestas
