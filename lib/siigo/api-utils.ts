import { obtenerTokenSiigo } from './auth';
import { SiigoApiError } from './api';

export async function withSiigoAuth<T>(
  callback: (token: string) => Promise<T>
): Promise<{ data?: T; error?: string; status?: number }> {
  try {
    const token = await obtenerTokenSiigo();
    const data = await callback(token);
    return { data };
  } catch (error) {
    console.error('Siigo API Error:', error);
    if (error instanceof SiigoApiError) {
      return { 
        error: error.message, 
        status: typeof error.code === 'number' ? error.code : 500 
      };
    }
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 500 
    };
  }
}

export async function fetchSiigoWithAuth<T>(
  endpoint: string,
  params: Record<string, string | number | boolean> = {}
): Promise<{ data?: T; error?: string; status?: number }> {
  return withSiigoAuth(async (token) => {
    const url = new URL(`https://api.siigo.com/v1/${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new SiigoApiError(
        errorData.message || 'Error en la petición a Siigo',
        response.status,
        errorData
      );
    }

    return response.json();
  });
}
