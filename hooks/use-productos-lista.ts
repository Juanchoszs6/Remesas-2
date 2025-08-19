import { useEffect, useState } from 'react';

export interface ProductoLista {
  codigo: string;
  nombre: string;
}

export function useProductosLista() {
  const [data, setData] = useState<ProductoLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/productos-lista')
      .then(res => {
        if (!res.ok) throw new Error('Error al obtener productos lista');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}