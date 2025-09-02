'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSiigoAuth } from '@/hooks/useSiigoAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Search, Loader2, Calendar as CalendarIcon, Eye, RefreshCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { InvoiceType } from '@/types/invoice';

// Using the imported InvoiceType from types

interface Customer {
  id: string;
  name: string;
  identification?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface InvoiceItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
  tax?: number;
  discount?: number;
}

interface Payment {
  id: string;
  method: string;
  value: number;
  due_date: string;
  status: string;
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  due_date?: string;
  customer: Customer;
  seller?: {
    id: string;
    name: string;
  };
  type: string;
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  status: 'draft' | 'posted' | 'cancelled' | 'paid' | 'partially_paid' | 'overdue';
  created_at: string;
  updated_at?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  document_type?: {
    id: string;
    name: string;
    code: string;
  };
  currency?: {
    code: string;
    symbol: string;
  };
  metadata?: Record<string, unknown>;
}

// Server component wrapper
export default function ConsultarFacturas() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <ClientSideConsultarFacturas />;
}

// Client component that will be dynamically imported
function ClientSideConsultarFacturas() {
  // Document types with their API endpoints
  const documentTypes = [
    { id: 'FC', name: 'Factura de Compra', endpoint: 'invoices' },
    { id: 'ND', name: 'Nota Débito', endpoint: 'debit-notes' },
    { id: 'DS', name: 'Documento Soporte', endpoint: 'support-documents' },
    { id: 'RP', name: 'Recibo de Pago', endpoint: 'payment-receipts' }
  ];

  const [selectedType, setSelectedType] = useState<string>('FC');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const { fetchWithAuth, loading: authLoading } = useSiigoAuth();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    minAmount: '',
    maxAmount: ''
  });

  const clearFilters = () => {
    setSelectedType('FC');
    setInvoices([]);
    setSearchPerformed(false);
    setError(null);
  };

  // Function to fetch documents from Siigo API based on selected type
  const fetchPurchaseInvoices = useCallback(async () => {
    if (!selectedType) return;
    
    try {
      setLoading(true);
      setError(null);
      setSearching(true);
      
      const selectedDocType = documentTypes.find(doc => doc.id === selectedType);
      if (!selectedDocType) {
        throw new Error('Tipo de documento no válido');
      }
      
      console.log(`Fetching ${selectedDocType.name} from Siigo API...`);
      
      // Build query parameters
      const params = new URLSearchParams({
        type: selectedType, // This will be used in the API route to determine the document type
        page: '1',
        pageSize: '100',
        includeDependencies: 'true'
      });

      // Make the API call to the documents endpoint with the type parameter
      const endpoint = `/api/siigo/documents?${params.toString()}`;
      console.log('API Endpoint:', endpoint);
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Error al cargar las facturas de Siigo');
      }
      
      const result = await response.json();
      console.log('Invoices API Response:', result);
      
      // Process the response
      if (!result.success) {
        console.error('API Error:', result.error);
        throw new Error(result.error || 'Error al procesar la respuesta del servidor');
      }

      // Get the data from the response
      const responseData = result.data || result;
      
      // Handle different response formats
      let invoicesData = [];
      if (Array.isArray(responseData)) {
        invoicesData = responseData;
      } else if (responseData.results && Array.isArray(responseData.results)) {
        invoicesData = responseData.results;
      } else if (responseData.items && Array.isArray(responseData.items)) {
        invoicesData = responseData.items;
      } else if (responseData.data && Array.isArray(responseData.data)) {
        invoicesData = responseData.data;
      } else if (typeof responseData === 'object' && responseData !== null) {
        // If it's an object but not an array, try to extract data from it
        const dataKeys = Object.keys(responseData);
        if (dataKeys.length > 0) {
          // If there's a key that looks like it contains an array, use that
          const arrayKey = dataKeys.find(key => 
            Array.isArray(responseData[key]) && 
            ['invoices', 'documents', 'items', 'results'].includes(key.toLowerCase())
          );
          
          if (arrayKey) {
            invoicesData = responseData[arrayKey];
          } else {
            // If no array found, try to use the first array value
            const firstArray = Object.values(responseData).find(Array.isArray);
            if (firstArray) {
              invoicesData = firstArray;
            }
          }
        }
      }

      // Map and transform the data to match our Invoice interface
      const formattedInvoices = invoicesData.map((invoice: any) => ({
        id: invoice.id || `inv-${Math.random().toString(36).substr(2, 9)}`,
        number: invoice.number || 'N/A',
        date: invoice.date || invoice.created_at || new Date().toISOString(),
        due_date: invoice.due_date || invoice.expiration_date || '',
        customer: {
          id: invoice.customer?.id || '',
          name: invoice.customer?.name || invoice.customer_name || 'Cliente no especificado',
          identification: invoice.customer?.identification || invoice.customer_identification || '',
          email: invoice.customer?.email || invoice.customer_email || '',
          phone: invoice.customer?.phone || invoice.customer_phone || '',
          address: invoice.customer?.address || invoice.customer_address || ''
        },
        seller: invoice.seller ? {
          id: invoice.seller.id || '',
          name: invoice.seller.name || ''
        } : undefined,
        type: invoice.type || 'FC',
        total: parseFloat(invoice.total) || 0,
        subtotal: parseFloat(invoice.subtotal) || 0,
        tax: parseFloat(invoice.tax) || 0,
        discount: parseFloat(invoice.discount) || 0,
        status: (invoice.status || 'draft').toLowerCase(),
        created_at: invoice.created_at || new Date().toISOString(),
        updated_at: invoice.updated_at || null,
        items: invoice.items?.map((item: any) => ({
          id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
          code: item.code || item.sku || '',
          description: item.description || item.name || 'Producto sin descripción',
          quantity: parseFloat(item.quantity) || 0,
          price: parseFloat(item.price) || 0,
          total: parseFloat(item.total) || 0,
          tax: parseFloat(item.tax) || 0,
          discount: parseFloat(item.discount) || 0
        })) || [],
        payments: invoice.payments?.map((payment: any) => ({
          id: payment.id || `pay-${Math.random().toString(36).substr(2, 9)}`,
          method: payment.method || payment.payment_method || 'No especificado',
          value: parseFloat(payment.value) || 0,
          due_date: payment.due_date || payment.payment_due_date || '',
          status: payment.status || 'pending'
        })) || [],
        document_type: invoice.document_type ? {
          id: invoice.document_type.id || '',
          name: invoice.document_type.name || '',
          code: invoice.document_type.code || ''
        } : {
          id: 'FC',
          name: 'Factura de Compra',
          code: 'FC'
        },
        currency: invoice.currency ? {
          code: invoice.currency.code || 'COP',
          symbol: invoice.currency.symbol || '$'
        } : { code: 'COP', symbol: '$' },
        metadata: invoice.metadata || {}
      }));

      console.log('Formatted invoices:', formattedInvoices);
      setInvoices(formattedInvoices);
      setSearchPerformed(true);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Error al cargar las facturas. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  // Initialize component with default values and fetch purchase invoices
  useEffect(() => {
    // Document types are loaded via the fetchDocumentTypes effect
    // Fetch purchase invoices from Siigo API
    fetchPurchaseInvoices();
  }, []);

  // Helper function to get status text and variant
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'paid':
        return { text: 'Pagada', variant: 'default' as const };
      case 'cancelled':
        return { text: 'Anulada', variant: 'destructive' as const };
      case 'draft':
        return { text: 'Borrador', variant: 'outline' as const };
      case 'overdue':
        return { text: 'Vencida', variant: 'destructive' as const };
      case 'partially_paid':
        return { text: 'Parcialmente Pagada', variant: 'default' as const };
      default:
        return { text: status, variant: 'outline' as const };
    }
  };

  // Function to render the invoices table
  const renderInvoicesTable = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500 mb-4" />
          <span className="ml-2">Cargando facturas...</span>
        </div>
      );
    }

    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {invoices.length} factura(s)
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchPurchaseInvoices}
              disabled={searching}
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
        </div>
        
        <div className="border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px]">Número</TableHead>
                  <TableHead className="w-[100px]">Fecha</TableHead>
                  <TableHead className="w-[120px]">Vencimiento</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right w-[120px]">Subtotal</TableHead>
                  <TableHead className="text-right w-[100px]">Impuestos</TableHead>
                  <TableHead className="text-right w-[100px]">Descuentos</TableHead>
                  <TableHead className="text-right w-[130px] font-bold">Total</TableHead>
                  <TableHead className="w-[140px]">Estado</TableHead>
                  <TableHead className="w-[80px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const statusInfo = getStatusInfo(invoice.status);
                  return (
                    <TableRow key={invoice.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="font-semibold">{invoice.number || 'N/A'}</span>
                          <span className="text-xs text-muted-foreground">
                            {invoice.document_type?.name || 'Factura'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {invoice.date 
                          ? format(new Date(invoice.date), 'dd/MM/yyyy', { locale: es })
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {invoice.due_date 
                          ? format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: es })
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{invoice.customer?.name || 'Sin nombre'}</span>
                          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            {invoice.customer?.identification && (
                              <span>{invoice.customer.identification}</span>
                            )}
                            {invoice.customer?.email && (
                              <span>• {invoice.customer.email}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: invoice.currency?.code || 'COP',
                        }).format(invoice.subtotal || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: invoice.currency?.code || 'COP',
                        }).format(invoice.tax || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.discount 
                          ? new Intl.NumberFormat('es-CO', {
                              style: 'currency',
                              currency: invoice.currency?.code || 'COP',
                            }).format(invoice.discount || 0)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: invoice.currency?.code || 'COP',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(invoice.total || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant} className="whitespace-nowrap">
                          {statusInfo.text}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setIsViewerOpen(true);
                            }}
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver detalles</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  };

  // Function to search invoices with authentication
  const handleSearch = useCallback(async () => {
    if (authLoading || !selectedType) return;
    
    try {
      setSearching(true);
      setError(null);
      
      // Build query parameters
      const params = new URLSearchParams({
        type: selectedType, // Use the selected document type directly
        page: '1',
        pageSize: '100',
        includeDependencies: 'true'
      });
      
      // Use the documents endpoint with type parameter
      const endpoint = `/api/siigo/documents`;
      const response = await fetchWithAuth(`${endpoint}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Error al buscar documentos');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al procesar la respuesta');
      }
      
      setInvoices(Array.isArray(result.data) ? result.data : []);
      setSearchPerformed(true);
    } catch (err) {
      console.error('Error searching documents:', err);
      setError('Error al buscar documentos. Por favor, intente nuevamente.');
    } finally {
      setSearching(false);
    }
  }, [authLoading, fetchWithAuth, selectedType]);

  const formatCurrency = (value: number, currency: string = 'COP') => {
    const formatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    
    // Remove the currency symbol if it's not needed
    if (currency === 'COP') {
      return formatter.format(value).replace('$', '').trim();
    }
    
    return formatter.format(value);
  };
  
  const formatDate = (dateString: string, includeTime: boolean = false) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    
    return format(
      date, 
      includeTime ? "dd/MM/yyyy 'a las' hh:mm a" : 'dd/MM/yyyy',
      { locale: es }
    );
  };


  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewerOpen(true);
  };

  const closeViewer = () => {
    setIsViewerOpen(false);
    setSelectedInvoice(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Consultar Facturas</h1>
        <Button variant="outline" onClick={handleSearch} disabled={searching}>
          {searching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Buscar Facturas
            </>
          )}
        </Button>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Factura</Label>
                <Select 
                  value={selectedType} 
                  onValueChange={setSelectedType}
                  disabled={loading}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Seleccione un tipo de documento" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={handleSearch} 
                  className="w-full" 
                  disabled={loading || searching}
                >
                  {searching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  {searching ? 'Buscando...' : 'Buscar Facturas'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Facturas de Compra</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          {renderInvoicesTable()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="font-medium">Error al buscar facturas</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : searching ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500 mb-4" />
              <p className="text-gray-600">Buscando facturas...</p>
            </div>
          ) : searchPerformed && invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No se encontraron facturas</h3>
              <p className="mt-1 text-sm text-gray-500">
                No hay facturas que coincidan con los criterios de búsqueda.
              </p>
            </div>
          ) : searchPerformed ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Número</TableHead>
                    <TableHead className="w-[100px]">Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="w-[120px]">Tipo</TableHead>
                    <TableHead className="text-right w-[120px]">Total</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{invoice.number}</span>
                          <span className="text-xs text-muted-foreground">
                            {invoice.document_type?.code || ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.date), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{invoice.customer?.name || 'N/A'}</div>
                        {invoice.customer?.identification && (
                          <div className="text-xs text-muted-foreground">
                            {invoice.customer.identification}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {documentTypes.find(t => t.id === invoice.document_type?.id)?.name || invoice.document_type?.name || invoice.type || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total, invoice.currency?.code || 'COP')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleViewInvoice(invoice)}
                          title="Ver detalles"
                          className="hover:bg-gray-100"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Buscar facturas</h3>
              <p className="mt-1 text-sm text-gray-500">
                Utiliza los filtros de arriba para buscar facturas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Viewer Dialog */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedInvoice && (
            <>
              <DialogHeader className="border-b pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-2xl">
                      {selectedInvoice.document_type?.name || 'Factura'} #{selectedInvoice.number}
                    </DialogTitle>
                    <DialogDescription>
                      {formatDate(selectedInvoice.date)}
                    </DialogDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {formatCurrency(selectedInvoice.total, selectedInvoice.currency?.code)}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-6">
                {/* Información del Cliente */}
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-medium mb-3 text-sm text-muted-foreground">CLIENTE</h3>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium">{selectedInvoice.customer?.name || 'N/A'}</p>
                        {selectedInvoice.customer?.identification && (
                          <p className="text-sm text-muted-foreground">
                            NIT/CC: {selectedInvoice.customer.identification}
                          </p>
                        )}
                        {selectedInvoice.customer?.email && (
                          <p className="text-sm text-muted-foreground">
                            {selectedInvoice.customer.email}
                          </p>
                        )}
                        {selectedInvoice.customer?.phone && (
                          <p className="text-sm text-muted-foreground">
                            Tel: {selectedInvoice.customer.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Información de la Factura */}
                  <div className="rounded-lg border p-4">
                    <h3 className="font-medium mb-3 text-sm text-muted-foreground">INFORMACIÓN</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Fecha de Emisión:</span>
                        <span className="text-sm font-medium">
                          {formatDate(selectedInvoice.date)}
                        </span>
                      </div>
                      {selectedInvoice.due_date && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Vencimiento:</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detalles de la Factura */}
                <div className="md:col-span-2">
                  <div className="rounded-lg border overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b">
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-6 font-medium text-sm text-muted-foreground">
                          Descripción
                        </div>
                        <div className="col-span-2 text-right font-medium text-sm text-muted-foreground">
                          Cantidad
                        </div>
                        <div className="col-span-2 text-right font-medium text-sm text-muted-foreground">
                          Precio
                        </div>
                        <div className="col-span-2 text-right font-medium text-sm text-muted-foreground">
                          Total
                        </div>
                      </div>
                    </div>
                    
                    <div className="divide-y">
                      {selectedInvoice.items?.length ? (
                        selectedInvoice.items.map((item) => (
                          <div key={item.id} className="px-4 py-3 hover:bg-gray-50">
                            <div className="grid grid-cols-12 gap-4 items-center">
                              <div className="col-span-6">
                                <div className="font-medium">{item.description}</div>
                                {item.code && (
                                  <div className="text-xs text-muted-foreground">
                                    Código: {item.code}
                                  </div>
                                )}
                              </div>
                              <div className="col-span-2 text-right">
                                {item.quantity}
                              </div>
                              <div className="col-span-2 text-right">
                                {formatCurrency(item.price, selectedInvoice.currency?.code)}
                              </div>
                              <div className="col-span-2 text-right font-medium">
                                {formatCurrency(item.total, selectedInvoice.currency?.code)}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-muted-foreground">
                          No hay artículos en esta factura
                        </div>
                      )}
                    </div>

                    {/* Resumen */}
                    <div className="border-t bg-gray-50 p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(selectedInvoice.subtotal || selectedInvoice.total, selectedInvoice.currency?.code)}</span>
                        </div>
                        
                        {selectedInvoice.discount && selectedInvoice.discount > 0 && (
                          <div className="flex justify-between">
                            <span>Descuento:</span>
                            <span className="text-red-600">
                              -{formatCurrency(selectedInvoice.discount, selectedInvoice.currency?.code)}
                            </span>
                          </div>
                        )}
                        
                        {selectedInvoice.tax && selectedInvoice.tax > 0 && (
                          <div className="flex justify-between">
                            <span>IVA ({(selectedInvoice.tax / (selectedInvoice.subtotal || selectedInvoice.total) * 100).toFixed(0)}%):</span>
                            <span>{formatCurrency(selectedInvoice.tax, selectedInvoice.currency?.code)}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between pt-2 border-t mt-2 font-bold text-lg">
                          <span>Total:</span>
                          <span>{formatCurrency(selectedInvoice.total, selectedInvoice.currency?.code)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={closeViewer}>Cerrar</Button>
                <Button>Descargar PDF</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
