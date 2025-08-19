import { NextResponse } from 'next/server';
import axios from 'axios';

// Configuración CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Función GET para obtener el token de acceso
export async function GET() {
  // Verificar que las variables de entorno estén definidas
  const authUrl = process.env.SIIGO_AUTH_URL;
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID;

  if (!authUrl || !username || !accessKey || !partnerId) {
    console.error('Faltan variables de entorno:', {
      authUrl: !!authUrl,
      username: !!username,
      accessKey: !!accessKey,
      partnerId: !!partnerId,
    });
    return new NextResponse(
      JSON.stringify({ error: 'Configuración incompleta en el servidor' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      }
    );
  }

  try {
    const response = await axios.post(
      authUrl,
      {
        username,
        access_key: accessKey,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Partner-Id': partnerId,
        },
      }
    );

    const token = response.data.access_token;
    if (!token) {
      throw new Error('No se recibió un token en la respuesta');
    }

    // Devolver la respuesta con los encabezados CORS
    return new NextResponse(JSON.stringify({ token }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    });
  } catch (error: any) {
    console.error('Error al obtener el token:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    return new NextResponse(
      JSON.stringify({
        error: 'Error al obtener el token',
        details: error.message,
        status: error.response?.status || 500,
      }),
      {
        status: error.response?.status || 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      }
    );
  }
}