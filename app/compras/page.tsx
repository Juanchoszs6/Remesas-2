'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type Purchase = {
  id: string;
  number: string;
  prefix?: string;
  date: string;
  status: string;
  total: number;
  currency: {
    code: string;
  };
  supplier: {
    name: string;
    identification: string;
  };
  document_type?: string;
};

export default function ComprasPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAllPurchases = async () => {
    const loadingState = isRefreshing ? setIsRefreshing : setIsLoading;
    loadingState(true);
    
    try {
      // Get the authentication token
      const tokenResponse = await fetch('/api/siigo/auth');
      
      if (!tokenResponse.ok) {
        throw new Error('No se pudo obtener el token de autenticación');
      }
      
      const { token } = await tokenResponse.json();
      
      if (!token) {
        throw new Error('Token de autenticación no válido');
      }

      // Fetch all purchases with the token
      const response = await fetch('/api/siigo/get-all-purchases', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al cargar las compras');
      }
      
      const data = await response.json();
      setPurchases(data);
      
    } catch (error) {
      console.error('Error al cargar compras:', error);
      toast.error(error instanceof Error ? error.message : 'Error desconocido al cargar compras');
    } finally {
      loadingState(false);
    }
  };

  useEffect(() => {
    fetchAllPurchases();
  }, []);

  const formatCurrency = (amount: number, currencyCode: string = 'COP') => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      active: { label: 'Activo', variant: 'default' },
      paid: { label: 'Pagado', variant: 'default' },
      pending: { label: 'Pendiente', variant: 'secondary' },
      cancelled: { label: 'Anulado', variant: 'destructive' },
      draft: { label: 'Borrador', variant: 'outline' },
    };

    const statusInfo = statusMap[status.toLowerCase()] || { label: status, variant: 'outline' as const };
    
    return (
      <Badge variant={statusInfo.variant} className="capitalize">
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Listado de Compras</h1>
        <Button 
          variant="outline" 
          onClick={fetchAllPurchases}
          disabled={isLoading || isRefreshing}
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Actualizando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </>
          )}
        </Button>
      </div>

      {isLoading && !isRefreshing ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando compras...</span>
        </div>
      ) : (
        <div className="grid gap-4">
          {purchases.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No se encontraron compras</p>
              </CardContent>
            </Card>
          ) : (
            purchases.map((purchase) => (
              <Card key={purchase.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {purchase.document_type || 'Compra'} #{purchase.prefix ? `${purchase.prefix}-` : ''}{purchase.number}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {purchase.supplier?.name} • {purchase.supplier?.identification}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(purchase.total, purchase.currency?.code)}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(purchase.date)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    {getStatusBadge(purchase.status)}
                    <Button variant="ghost" size="sm" className="text-primary">
                      Ver detalles
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
