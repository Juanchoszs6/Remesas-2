import { obtenerTokenSiigo } from '@/lib/siigo/auth';
import { fetchSiigoData } from '@/lib/siigo/api';

export interface AnalyticsData {
  period: string;
  totalInvoices: number;
  totalAmount: number;
  averageAmount: number;
  currency: string;
  byMonth: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  bySupplier: Array<{
    supplierId: string;
    supplierName: string;
    count: number;
    amount: number;
  }>;
}

/**
 * Obtiene datos analíticos de facturas de Siigo
 * @param period Período de tiempo para el análisis (today, 1m, 3m, 6m, 1y)
 */
export async function obtenerAnalyticsSiigo(period: string = '6m'): Promise<AnalyticsData> {
  try {
    // Obtener token de autenticación
    const token = await obtenerTokenSiigo();
    
    // Calcular fechas según el período
    const { startDate, endDate } = calculateDateRange(period);
    
    // Obtener facturas del período
    const invoices = await fetchSiigoData<{
      id: string;
      number: string;
      date: string;
      status: string;
      supplier: {
        id: string;
        name: string;
      };
      total: number;
      currency: {
        code: string;
      };
    }>(
      '/v1/purchase-invoices',
      token,
      {
        created_start: startDate.toISOString().split('T')[0],
        created_end: endDate.toISOString().split('T')[0],
        page_size: 1000, // Número máximo de facturas por página
      }
    );

    // Procesar datos para el análisis
    const currency = invoices.results[0]?.currency?.code || 'COP';
    const totalInvoices = invoices.results.length;
    const totalAmount = invoices.results.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const averageAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

    // Agrupar por mes
    const byMonthMap = new Map<string, { count: number; amount: number }>();
    // Agrupar por estado
    const byStatusMap = new Map<string, { count: number; amount: number }>();
    // Agrupar por proveedor
    const bySupplierMap = new Map<string, { name: string; count: number; amount: number }>();

    invoices.results.forEach(invoice => {
      const date = new Date(invoice.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Actualizar estadísticas por mes
      const monthData = byMonthMap.get(monthKey) || { count: 0, amount: 0 };
      monthData.count += 1;
      monthData.amount += invoice.total || 0;
      byMonthMap.set(monthKey, monthData);

      // Actualizar estadísticas por estado
      const status = invoice.status || 'unknown';
      const statusData = byStatusMap.get(status) || { count: 0, amount: 0 };
      statusData.count += 1;
      statusData.amount += invoice.total || 0;
      byStatusMap.set(status, statusData);

      // Actualizar estadísticas por proveedor
      if (invoice.supplier) {
        const supplierId = invoice.supplier.id;
        const supplierData = bySupplierMap.get(supplierId) || { 
          name: invoice.supplier.name || 'Desconocido', 
          count: 0, 
          amount: 0 
        };
        supplierData.count += 1;
        supplierData.amount += invoice.total || 0;
        bySupplierMap.set(supplierId, supplierData);
      }
    });

    // Convertir mapas a arrays ordenados
    const byMonth = Array.from(byMonthMap.entries())
      .map(([month, data]) => ({
        month,
        count: data.count,
        amount: data.amount
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const byStatus = Array.from(byStatusMap.entries())
      .map(([status, data]) => ({
        status,
        count: data.count,
        amount: data.amount
      }))
      .sort((a, b) => b.amount - a.amount);

    const bySupplier = Array.from(bySupplierMap.entries())
      .map(([supplierId, data]) => ({
        supplierId,
        supplierName: data.name,
        count: data.count,
        amount: data.amount
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Limitar a los 10 principales proveedores

    return {
      period,
      totalInvoices,
      totalAmount,
      averageAmount,
      currency,
      byMonth,
      byStatus,
      bySupplier
    };

  } catch (error) {
    console.error('Error al obtener datos analíticos de Siigo:', error);
    throw new Error('No se pudieron obtener los datos analíticos');
  }
}

/**
 * Calcula el rango de fechas según el período especificado
 */
function calculateDateRange(period: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case '1m':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case '3m':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case '6m':
    default:
      startDate.setMonth(startDate.getMonth() - 6);
      break;
  }
  
  return { startDate, endDate };
}
