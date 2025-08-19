import { useEffect, useState } from 'react';

export interface ProductoSinGuion {
  codigo: string;
  nombre: string;
}

export function useProductosSinGuion() {
  const [data, setData] = useState<ProductoSinGuion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/productos-sin-guion')
      .then(res => {
        if (!res.ok) throw new Error('Error al obtener productos sin guión');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
