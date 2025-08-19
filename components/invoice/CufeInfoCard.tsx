import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Supplier {
  id?: string;
  identification?: string;
  branch_office?: string;
  name?: string;
}

interface Document {
  id?: number;
  number?: number;
  name?: string;
}

interface Currency {
  code?: string;
  exchange_rate?: string;
}

interface Item {
  id?: string;
  code?: string;
  description?: string;
  quantity?: number;
  price?: number;
  discount?: {
    percentage?: number;
    value?: number;
  };
  taxes?: Array<{
    id?: number;
    name?: string;
    percentage?: number;
    value?: number;
    total?: number;
  }>;
}

interface Payment {
  id?: number;
  name?: string;
  value?: number;
  due_date?: string;
}

interface Status {
  status?: string;
  status_date?: string;
}

interface CufeInfoCardProps {
  invoice: {
    id?: string;
    document?: Document;
    number?: number;
    name?: string;
    date?: string;
    due_date?: string;
    supplier?: Supplier;
    cost_center?: number | { code?: string; name?: string };
    provider_invoice?: {
      prefix?: string;
      number?: string;
    };
    discount_type?: string;
    discount_value?: number;
    currency?: Currency;
    subtotal?: number;
    tax_total?: number;
    total?: number;
    total_to_pay?: number;
    balance?: number;
    observations?: string;
    items?: Item[];
    payments?: Payment[];
    created?: string;
    last_updated?: string;
    status?: Status;
    additional_fields?: Record<string, any>;
  } | null;
}

export function CufeInfoCard({ invoice }: CufeInfoCardProps) {
  if (!invoice) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No especificada';
    try {
      return format(new Date(dateString), "PPP", { locale: es });
    } catch (e) {
      return dateString;
    }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: invoice.currency?.code || 'COP',
    }).format(value);
  };

  // Calculate totals if not present in the invoice
  const subtotal = invoice.subtotal || (invoice.items || []).reduce((sum, item) => {
    const quantity = item.quantity || 0;
    const price = item.price || 0;
    const discount = item.discount?.value || 0;
    return sum + (quantity * price) - discount;
  }, 0);

  const taxTotal = invoice.tax_total || (invoice.items || []).reduce((sum, item) => {
    return sum + (item.taxes?.reduce((taxSum, tax) => taxSum + (tax.value || 0), 0) || 0);
  }, 0);

  const total = invoice.total || subtotal + taxTotal;
  const balance = invoice.balance ?? total - ((invoice.payments || []).reduce((sum, p) => sum + (p.value || 0), 0));
  const totalPaid = total - balance;

  return (
    <Card className="mt-6">
      <CardHeader className="bg-muted/50">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <CardTitle>Información de la Factura</CardTitle>
            <CardDescription>Detalles de la factura electrónica</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge 
              variant={balance === 0 ? 'default' : 'destructive'} 
              className="text-sm px-3 py-1 bg-green-600 hover:bg-green-700"
            >
              {balance === 0 ? 'Pagada' : 'Pendiente de pago'}
            </Badge>
            {invoice.status?.status && (
              <Badge variant="outline" className="text-xs">
                Estado: {invoice.status.status}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Información General */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Datos de la Factura</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Número:</span>
                <span className="font-medium">{invoice.document?.number || invoice.number || 'N/A'}</span>
                
                <span className="text-muted-foreground">Referencia:</span>
                <span className="font-medium">
                  {invoice.provider_invoice?.prefix ? `${invoice.provider_invoice.prefix} ` : ''}
                  {invoice.provider_invoice?.number || 'N/A'}
                </span>
                
                <span className="text-muted-foreground">Fecha de emisión:</span>
                <span className="font-medium">{formatDate(invoice.date)}</span>
                
                {invoice.due_date && (
                  <>
                    <span className="text-muted-foreground">Vencimiento:</span>
                    <span className="font-medium">{formatDate(invoice.due_date)}</span>
                  </>
                )}
                
                <span className="text-muted-foreground">Tipo de documento:</span>
                <span className="font-medium">{invoice.document?.name || 'No especificado'}</span>
                
                <span className="text-muted-foreground">Moneda:</span>
                <span className="font-medium">
                  {invoice.currency?.code || 'COP'}
                  {invoice.currency?.exchange_rate ? ` (T.C: ${invoice.currency.exchange_rate})` : ''}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <h3 className="font-semibold text-lg">Centro de Costo</h3>
              <div className="text-sm">
                {typeof invoice.cost_center === 'object' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Código:</span>
                    <span className="font-medium">{invoice.cost_center.code || 'N/A'}</span>
                    <span className="text-muted-foreground">Nombre:</span>
                    <span className="font-medium">{invoice.cost_center.name || 'No especificado'}</span>
                  </div>
                ) : (
                  <span className="font-medium">{invoice.cost_center || 'No especificado'}</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Proveedor</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Identificación:</span>
                <span className="font-medium">{invoice.supplier?.identification || 'No especificado'}</span>
                
                <span className="text-muted-foreground">Nombre:</span>
                <span className="font-medium">{invoice.supplier?.name || 'No especificado'}</span>
                
                {invoice.supplier?.branch_office && (
                  <>
                    <span className="text-muted-foreground">Sucursal:</span>
                    <span className="font-medium">{invoice.supplier.branch_office}</span>
                  </>
                )}
                
                {invoice.supplier?.id && (
                  <>
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-mono text-sm">{invoice.supplier.id}</span>
                  </>
                )}
              </div>
            </div>

            {invoice.status?.status_date && (
              <div className="space-y-2 pt-4 border-t">
                <h3 className="font-semibold text-lg">Estado</h3>
                <div className="text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">Estado actual:</span>
                    <span className="font-medium capitalize">{invoice.status.status?.toLowerCase() || 'No especificado'}</span>
                    <span className="text-muted-foreground">Última actualización:</span>
                    <span className="font-medium">{formatDate(invoice.status.status_date)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Totales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6 pb-2 border-t">
          <div className="space-y-1 p-4 bg-muted/20 rounded-lg">
            <p className="text-sm text-muted-foreground">Subtotal</p>
            <p className="text-lg font-semibold">
              {formatCurrency(subtotal)}
            </p>
          </div>
          
          <div className="space-y-1 p-4 bg-muted/10 rounded-lg">
            <p className="text-sm text-muted-foreground">Impuestos</p>
            <p className="text-lg font-semibold">
              {formatCurrency(taxTotal)}
            </p>
          </div>
          
          {invoice.discount_value && invoice.discount_value > 0 && (
            <div className="space-y-1 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Descuento</p>
                {invoice.discount_type && (
                  <Badge variant="outline" className="text-xs">
                    {invoice.discount_type}
                  </Badge>
                )}
              </div>
              <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                -{formatCurrency(invoice.discount_value)}
              </p>
            </div>
          )}
          
          <div className="space-y-1 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm text-muted-foreground">Total Factura</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(total)}
            </p>
            
            {balance !== total && (
              <div className="mt-2 pt-2 border-t border-primary/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pagado:</span>
                  <span>{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Saldo pendiente:</span>
                  <span className={balance > 0 ? 'text-destructive' : 'text-green-600'}>
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        {(invoice.items && invoice.items.length > 0) && (
          <div className="space-y-4 pt-8 border-t">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Detalle de Ítems</h3>
              <span className="text-sm text-muted-foreground">
                {invoice.items.length} {invoice.items.length === 1 ? 'ítem' : 'ítems'} en total
              </span>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 w-24">Código</th>
                      <th className="text-left p-3">Descripción</th>
                      <th className="text-right p-3 w-24">Cantidad</th>
                      <th className="text-right p-3 w-32">Precio Unit.</th>
                      {invoice.discount_value ? (
                        <th className="text-right p-3 w-32">Descuento</th>
                      ) : null}
                      <th className="text-right p-3 w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, index) => {
                      const itemTotal = (item.quantity || 0) * (item.price || 0);
                      const itemDiscount = item.discount?.value || 0;
                      const itemTax = item.taxes?.reduce((sum, tax) => sum + (tax.value || 0), 0) || 0;
                      
                      return (
                        <tr key={item.id || index} className="border-t hover:bg-muted/20">
                          <td className="p-3">
                            <div className="font-medium">{item.code || 'N/A'}</div>
                            {item.id && (
                              <div className="text-xs text-muted-foreground">
                                ID: {item.id}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{item.description || 'Sin descripción'}</div>
                            {item.taxes && item.taxes.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.taxes.map((tax, taxIndex) => (
                                  <Badge key={taxIndex} variant="outline" className="text-xs">
                                    {tax.name || 'Impuesto'} {tax.percentage ? `(${tax.percentage}%)` : ''}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right align-top">
                            {item.quantity?.toLocaleString('es-CO', { minimumFractionDigits: 2 }) || '0.00'}
                          </td>
                          <td className="p-3 text-right align-top">
                            {formatCurrency(item.price)}
                          </td>
                          {invoice.discount_value ? (
                            <td className="p-3 text-right align-top text-destructive">
                              {itemDiscount > 0 ? `-${formatCurrency(itemDiscount)}` : '-'}
                            </td>
                          ) : null}
                          <td className="p-3 text-right align-top font-medium">
                            <div>{formatCurrency(itemTotal - itemDiscount)}</div>
                            {itemTax > 0 && (
                              <div className="text-xs text-muted-foreground">
                                IVA: {formatCurrency(itemTax)}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Pagos */}
        {(invoice.payments && invoice.payments.length > 0) && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Pagos</h3>
            <div className="grid gap-4">
              {invoice.payments.map((payment, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{payment.name || 'Pago'}</p>
                      {payment.due_date && (
                        <p className="text-sm text-muted-foreground">
                          Vence: {formatDate(payment.due_date)}
                        </p>
                      )}
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(payment.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observaciones */}
        {invoice.observations && (
          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">Observaciones</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.observations}</p>
          </div>
        )}

        {/* Metadatos */}
        <div className="pt-4 border-t text-xs text-muted-foreground">
          <p>ID: {invoice.id || 'N/A'}</p>
          {invoice.created && <p>Creada: {formatDate(invoice.created)}</p>}
          {invoice.last_updated && <p>Última actualización: {formatDate(invoice.last_updated)}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default CufeInfoCard;
