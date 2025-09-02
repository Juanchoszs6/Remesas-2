import { useState, useEffect } from 'react';

interface SiigoToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export function useSiigoAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Function to get a new token
  const getToken = async (): Promise<string> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/siigo/obtener-token');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get Siigo token');
      }
      
      // The token is directly returned in the response, not in an access_token field
      const token = data.token || data.access_token;
      if (!token) {
        throw new Error('No token found in response');
      }
      
      setToken(token);
      return token;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get Siigo token');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Function to make authenticated requests
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<any> => {
    try {
      // If we don't have a token, get one first
      let authToken = token;
      if (!authToken) {
        authToken = await getToken();
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // If token is expired, try to get a new one and retry
      if (response.status === 401) {
        authToken = await getToken();
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });
        return await retryResponse.json();
      }

      return await response.json();
    } catch (err) {
      console.error('Error in fetchWithAuth:', err);
      throw err;
    }
  };

  return {
    token,
    loading,
    error,
    getToken,
    fetchWithAuth,
  };
}

export default useSiigoAuth;
