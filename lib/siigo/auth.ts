export async function obtenerTokenSiigo(): Promise<string | null> {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID || '';

  if (!username || !accessKey || !partnerId) {
    console.error('[SIIGO-AUTH] ❌ Credenciales faltantes');
    return null;
  }

  const credentials = Buffer.from(`${username}:${accessKey}`).toString('base64');

  try {
    const response = await fetch('https://api.siigo.com/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
        'Partner-Id': partnerId,
      },
      body: JSON.stringify({
        username,
        access_key: accessKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SIIGO-AUTH] ❌ Error en autenticación:', errorText);
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error('[SIIGO-AUTH] 💥 Error al obtener token:', error);
    return null;
  }
}
