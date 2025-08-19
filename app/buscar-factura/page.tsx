'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type InvoiceStatus = 'active' | 'draft' | 'voided' | 'deleted' | 'all';

interface InvoiceItem {
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  tax: {
    id: number;
    name: string;
    percentage: number;
    amount: number;
  };
}

interface Payment {
  id: number;
  name: string;
  value: number;
  due_date: string;
  paid: boolean;
}

interface InvoiceData {
  id: string;
  number: string;
  prefix: string;
  date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  balance: number;
  currency: {
    code: string;
    exchange_rate: number;
  };
  supplier: {
    identification: string;
    name: string;
    phone: string;
    address: string;
  };
  items: InvoiceItem[];
  payments: Payment[];
  observations?: string;
  created_at: string;
  updated_at: string;
}

export default function BuscarFacturaPage() {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invoiceId.trim()) {
      setError('Por favor ingrese un número de factura, ID o documento');
      return;
    }

    setIsLoading(true);
    setError(null);
    setInvoice(null);

    try {
      // Primero obtenemos todas las facturas
      const tokenResponse = await fetch('/api/siigo/auth');
      
      if (!tokenResponse.ok) {
        throw new Error('No se pudo obtener el token de autenticación');
      }
      
      const { token } = await tokenResponse.json();
      
      if (!token) {
        throw new Error('Token de autenticación no válido');
      }

      // Obtenemos todas las facturas
      const response = await fetch('/api/siigo/get-all-purchases', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al buscar facturas');
      }

      const allInvoices = await response.json();
      
      // Buscamos la factura por diferentes campos
      const searchTerm = invoiceId.trim().toLowerCase();
      const foundInvoice = allInvoices.find((inv: any) => 
        String(inv.number).toLowerCase() === searchTerm ||
        inv.id.toLowerCase() === searchTerm ||
        String(inv.document_number).toLowerCase() === searchTerm
      );

      if (!foundInvoice) {
        throw new Error('No se encontró ninguna factura con ese número o ID');
      }

      setInvoice(foundInvoice);
    } catch (err) {
      console.error('Error al buscar factura:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al buscar la factura');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP', { locale: es });
    } catch (e) {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: invoice?.currency?.code || 'COP',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    const statusMap = {
      active: { label: 'Activa', variant: 'default' as const },
      draft: { label: 'Borrador', variant: 'outline' as const },
      voided: { label: 'Anulada', variant: 'destructive' as const },
      deleted: { label: 'Eliminada', variant: 'destructive' as const },
      all: { label: 'Todas', variant: 'secondary' as const },
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'default' as const };
    
    return (
      <Badge variant={statusInfo.variant} className="capitalize">
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Button 
        variant="ghost" 
        className="mb-6"
        onClick={() => router.back()}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Buscar Factura de Compra/Gasto</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Buscar Factura</CardTitle>
            <CardDescription className="mt-2">
              Puedes buscar por número de factura, ID o número de documento
            </CardDescription>
            <CardDescription>
              Ingrese el ID de la factura de compra o gasto para ver sus detalles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="Número de factura, ID o documento"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </form>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {invoice && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">
                      Factura #{invoice.prefix ? `${invoice.prefix}-${invoice.number}` : invoice.number}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      ID: {invoice.id}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(invoice.status)}
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(invoice.date)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2">Proveedor</h3>
                    <div className="space-y-1">
                      <p className="font-medium">{invoice.supplier.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.supplier.identification}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.supplier.phone}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.supplier.address}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Información de Pago</h3>
                    <div className="space-y-1">
                      <p className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(invoice.subtotal)}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Impuestos:</span>
                        <span>{formatCurrency(invoice.tax)}</span>
                      </p>
                      <p className="flex justify-between font-semibold text-lg mt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(invoice.total)}</span>
                      </p>
                      <p className="flex justify-between text-sm">
                        <span>Saldo pendiente:</span>
                        <span className={invoice.balance > 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                          {formatCurrency(invoice.balance)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ítems de la Factura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <div className="grid grid-cols-12 bg-muted/50 p-2 font-medium text-sm">
                    <div className="col-span-5">Descripción</div>
                    <div className="col-span-2 text-right">Cantidad</div>
                    <div className="col-span-2 text-right">Precio Unit.</div>
                    <div className="col-span-3 text-right">Total</div>
                  </div>
                  {invoice.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 p-2 border-t text-sm">
                      <div className="col-span-5">
                        <div className="font-medium">{item.description}</div>
                        <div className="text-xs text-muted-foreground">{item.code}</div>
                      </div>
                      <div className="col-span-2 text-right">{item.quantity}</div>
                      <div className="col-span-2 text-right">{formatCurrency(item.price)}</div>
                      <div className="col-span-3 text-right font-medium">
                        {formatCurrency(item.total)}
                      </div>
                      {item.discount > 0 && (
                        <div className="col-span-10 text-right text-xs text-muted-foreground">
                          Descuento: {formatCurrency(item.discount)}
                        </div>
                      )}
                      <div className="col-span-2 text-right text-xs text-muted-foreground">
                        IVA {item.tax.percentage}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {invoice.payments && invoice.payments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pagos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {invoice.payments.map((payment, index) => (
                      <div key={index} className="p-3 border rounded-md">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{payment.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Vence: {formatDate(payment.due_date)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(payment.value)}</p>
                            <span className={`text-xs ${payment.paid ? 'text-green-600' : 'text-amber-600'}`}>
                              {payment.paid ? 'Pagado' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {invoice.observations && (
              <Card>
                <CardHeader>
                  <CardTitle>Observaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{invoice.observations}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
