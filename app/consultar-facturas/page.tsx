'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { FileText, Search, Loader2, Calendar as CalendarIcon, Eye, Printer } from 'lucide-react';
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

type LocalInvoiceType = {
  id: string;
  name: string;
  code: string;
  type: 'FC' | 'ND' | 'DS' | 'RP';
  description: string;
  active: boolean;
  document_support: boolean;
  cost_center: boolean;
  cost_center_mandatory: boolean;
  automatic_number: boolean;
  consecutive?: number;
  decimals: boolean;
  consumption_tax: boolean;
  reteiva: boolean;
  reteica: boolean;
}

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
  const [date, setDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [invoiceTypes, setInvoiceTypes] = useState<InvoiceType[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [documentTypes, setDocumentTypes] = useState<InvoiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    minAmount: '',
    maxAmount: ''
  });

  const clearFilters = () => {
    setDate(null);
    setEndDate(null);
    setSelectedType('all');
    setInvoices([]);
    setSearchPerformed(false);
    setError(null);
    setFilters({
      status: '',
      minAmount: '',
      maxAmount: ''
    });
    // Reset to default document types
    setDocumentTypes(Object.values(DOCUMENT_TYPES));
  };

  // Document types configuration with all required fields
  const DOCUMENT_TYPES = {
    FC: { 
      id: '1', 
      name: 'Factura', 
      code: '1', 
      type: 'FC', 
      description: 'Factura de Compra',
      active: true,
      document_support: true,
      cost_center: false,
      cost_center_mandatory: false,
      automatic_number: true,
      consecutive: 1,
      decimals: true,
      consumption_tax: true,
      reteiva: true,
      reteica: true
    },
    ND: { 
      id: '2', 
      name: 'Nota Débito', 
      code: '2', 
      type: 'ND', 
      description: 'Nota Débito',
      active: true,
      document_support: true,
      cost_center: false,
      cost_center_mandatory: false,
      automatic_number: true,
      consecutive: 1,
      decimals: true,
      consumption_tax: true,
      reteiva: true,
      reteica: true
    },
    DS: { 
      id: '3', 
      name: 'Documento Soporte', 
      code: '3', 
      type: 'DS', 
      description: 'Documento Soporte',
      active: true,
      document_support: true,
      cost_center: false,
      cost_center_mandatory: false,
      automatic_number: true,
      consecutive: 1,
      decimals: true,
      consumption_tax: true,
      reteiva: true,
      reteica: true
    },
    RP: { 
      id: '4', 
      name: 'Recibo de Pago', 
      code: '4', 
      type: 'RP', 
      description: 'Recibo de Pago',
      active: true,
      document_support: true,
      cost_center: false,
      cost_center_mandatory: false,
      automatic_number: true,
      consecutive: 1,
      decimals: true,
      consumption_tax: true,
      reteiva: true,
      reteica: true
    }
  };

  // Initialize component with default document types
  useEffect(() => {
    const today = new Date();
    setDate(today);
    setEndDate(today);
    
    // Set default document types
    setDocumentTypes([
      DOCUMENT_TYPES.FC,
      DOCUMENT_TYPES.ND,
      DOCUMENT_TYPES.DS,
      DOCUMENT_TYPES.RP
    ]);
    
    // Try to fetch from API in the background
    const fetchDocumentTypes = async () => {
      try {
        const response = await fetch('/api/siigo/invoices/types?type=FC,ND,DS,RP');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setDocumentTypes(data);
          }
        }
      } catch (error) {
        console.error('Error fetching document types:', error);
      }
    };
    
    fetchDocumentTypes();
  }, []);

  const handleSearch = async () => {
    if (!date) {
      setError('Por favor seleccione una fecha de inicio');
      return;
    }

    setSearching(true);
    setError(null);
    setInvoices([]);
    setSearchPerformed(true);

    try {
      const params = new URLSearchParams();
      
      // Add date filters
      if (date) {
        params.append('start_date', date.toISOString().split('T')[0]);
      }
      
      if (endDate) {
        params.append('end_date', endDate.toISOString().split('T')[0]);
      }

      // Make individual API calls for each document type if 'all' is selected
      let responses = [];
      
      if (selectedType === 'all') {
        // Get all document types and make individual requests
        const fetchPromises = documentTypes.map(async (type) => {
          const typeParams = new URLSearchParams(params.toString());
          typeParams.append('type', type.code); // Changed from document_type to type
          const response = await fetch(`/api/siigo/invoices/search?${typeParams.toString()}`);
          if (!response.ok) {
            throw new Error(`Error al buscar facturas de tipo ${type.code}`);
          }
          return response.json();
        });
        
        responses = await Promise.all(fetchPromises);
      } else {
        // Single document type request
        const type = documentTypes.find(t => t.id === selectedType);
        if (type) {
          params.append('type', type.code); // Changed from document_type to type
        }
        const response = await fetch(`/api/siigo/invoices/search?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al buscar facturas');
        }
        responses = [await response.json()];
      }

      // Flatten the array of responses into a single array of invoices
      const allInvoices = responses.flat();
      setInvoices(allInvoices);
      setSearchPerformed(true);
      setSearching(false);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError('Error al cargar las facturas');
      setSearching(false);
    }
  };

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha Inicio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? (
                        format(date, 'PPP', { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      selected={date || undefined}
                      onSelect={(selectedDate) => selectedDate && setDate(selectedDate)}
                      mode="single"
                      className="rounded-md border p-3"
                      showOutsideDays
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha Fin (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        isSameDay(endDate, new Date()) ? 'Hoy' : format(endDate, 'PPP', { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={endDate || undefined}
                      onSelect={(date) => date && setEndDate(date)}
                      className="rounded-md border p-3"
                      disabled={(day) => {
                        const disabledBefore = date || new Date();
                        return day < new Date(disabledBefore.setHours(0, 0, 0, 0));
                      }}
                      showOutsideDays
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Factura</Label>
                <Select 
                  value={selectedType} 
                  onValueChange={setSelectedType}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center">
                        <span className="font-medium">Todos los tipos</span>
                      </div>
                    </SelectItem>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{type.name} ({type.code})</span>
                          {type.description && (
                            <span className="text-xs text-muted-foreground">
                              {type.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end h-full">
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

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-medium text-blue-800 mb-2">Consejos de búsqueda</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Selecciona un rango de fechas para buscar facturas en ese período</li>
                <li>• Deja la fecha fin vacía para buscar solo en la fecha de inicio</li>
                <li>• Usa el filtro de tipo para buscar por tipo de factura específico</li>
              </ul>
            </div>
          </div>
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
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>ID Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{invoice.number}</TableCell>
                      <TableCell>
                        {format(new Date(invoice.date), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium">{invoice.customer?.name || 'N/A'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {invoice.customer?.id || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {invoiceTypes.find(t => t.id === invoice.type)?.name || invoice.type}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleViewInvoice(invoice)}
                          title="Ver detalles"
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
                <Button 
                  variant="outline" 
                  onClick={() => window.print()}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button>Descargar PDF</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
