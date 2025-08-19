import { NextResponse } from 'next/server';

async function getSiigoToken() {
  const SIIGO_AUTH_URL = process.env.SIIGO_AUTH_URL;
  const SIIGO_USERNAME = process.env.SIIGO_USERNAME;
  const SIIGO_ACCESS_KEY = process.env.SIIGO_ACCESS_KEY;
  const SIIGO_PARTNER_ID = process.env.SIIGO_PARTNER_ID;

  try {
    const response = await fetch(SIIGO_AUTH_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        username: SIIGO_USERNAME,
        access_key: SIIGO_ACCESS_KEY,
        partner_id: SIIGO_PARTNER_ID,
      }),
    });
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    return null;
  }
}

export async function GET() {
  try {
    const token = await getSiigoToken();
    if (!token) {
      return NextResponse.json({ error: 'No se pudo obtener el token de SIIGO' }, { status: 401 });
    }
    // Endpoint oficial para listar tipos de documentos en SIIGO
    const response = await fetch('https://api.siigo.com/v1/document_types', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: 'Error al consultar documentos en SIIGO', details: err }, { status: 500 });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Error inesperado', details: String(error) }, { status: 500 });
  }
}
