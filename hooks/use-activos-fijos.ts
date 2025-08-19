import { useEffect, useState } from 'react';

export interface ActivoFijo {
  id?: number;
  grupo?: string;
  codigo: string;
  nombre: string;
}

export function useActivosFijos() {
  const [data, setData] = useState<ActivoFijo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/activos-fijos')
      .then(res => {
        if (!res.ok) throw new Error('Error al obtener activos fijos');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
} 