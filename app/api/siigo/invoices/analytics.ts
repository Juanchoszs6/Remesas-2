import { obtenerTokenSiigo } from '../siigoAuth';
import axios from 'axios';

// Interfaces para los datos de analytics
export interface InvoiceAnalytics {
  totalInvoices: number;
  totalAmount: number;
  averageAmount: number;
  monthlyGrowth: number;
  topSuppliers: Array<{
    name: string;
    identification: string;
    totalAmount: number;
    invoiceCount: number;
  }>;
  monthlyData: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  recentInvoices: Array<{
    id: string;
    date: string;
    supplier: string;
    amount: number;
    status: 'success' | 'pending' | 'error';
    type: 'purchase' | 'expense';
  }>;
}

// Función para obtener facturas desde Siigo
async function obtenerFacturasSiigo(token: string, startDate: string, endDate: string) {
  try {
    console.log(`🔍 Obteniendo facturas de Siigo desde ${startDate} hasta ${endDate}`);
    
    // Validar fechas
    if (!startDate || !endDate) {
      throw new Error('Fechas de inicio y fin son requeridas');
    }
    
    // Validar token
    if (!token) {
      throw new Error('Token de autenticación es requerido');
    }
    
    // Configuración común para las peticiones
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Partner-Id': process.env.SIIGO_PARTNER_ID || 'RemesasYMensajes'
    };
    
    // Obtener facturas de compra
    let purchases = [];
    try {
      const purchasesResponse = await axios.get('https://api.siigo.com/v1/purchases', {
        headers,
        params: {
          created_start: startDate,
          created_end: endDate,
          page: 1,
          page_size: 100
        }
      });
      purchases = purchasesResponse.data.results || [];
    } catch (purchaseError: any) {
      console.error('Error al obtener facturas de compra:', {
        status: purchaseError.response?.status,
        message: purchaseError.message
      });
      // No lanzar error, continuar con vouchers
    }
    
    // Obtener gastos/egresos (vouchers)
    let vouchers = [];
    try {
      const vouchersResponse = await axios.get('https://api.siigo.com/v1/vouchers', {
        headers,
        params: {
          created_start: startDate,
          created_end: endDate,
          type: 'expense', // Filtrar solo por gastos/egresos
          page: 1,
          page_size: 100
        }
      });
      vouchers = vouchersResponse.data.results || [];
    } catch (voucherError: any) {
      console.error('Error al obtener vouchers:', {
        status: voucherError.response?.status,
        message: voucherError.message
      });
      // No lanzar error, continuar con los datos que tengamos
    }
    
    // Si no se pudo obtener ningún dato, lanzar error
    if (purchases.length === 0 && vouchers.length === 0) {
      throw new Error('No se pudieron obtener datos de facturas ni vouchers');
    }
    
    return {
      purchases,
      vouchers
    };
  } catch (error: any) {
    console.error('Error al obtener facturas de Siigo:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(`Error al obtener facturas: ${error.message}`);
  }
}

// Función para procesar los datos y generar analytics
function procesarDatosFacturas(data: any, monthsToGenerate: number = 6) {
  const { purchases, vouchers } = data;
  const allInvoices = [...purchases, ...vouchers];
  
  // Calcular totales
  const totalInvoices = allInvoices.length;
  
  // Calcular monto total con validación de datos
  const totalAmount = allInvoices.reduce((sum: number, invoice: any) => {
    // Verificar que el total sea un número válido
    const invoiceTotal = typeof invoice.total === 'number' ? invoice.total : 0;
    return sum + invoiceTotal;
  }, 0);
  
  // Calcular promedio con validación
  let averageAmount = 0;
  if (totalInvoices > 0) {
    averageAmount = totalAmount / totalInvoices;
    // Redondear a 2 decimales
    averageAmount = parseFloat(averageAmount.toFixed(2));
  }
  
  // Agrupar por proveedor
  const supplierMap = new Map();
  allInvoices.forEach((invoice: any) => {
    // Verificar que el invoice tenga datos de proveedor
    const supplierName = invoice.supplier?.name || invoice.third_party?.name || 'Proveedor Desconocido';
    const supplierId = invoice.supplier?.identification || invoice.third_party?.identification || 'ID Desconocido';
    
    // Validar que el total sea un número
    let invoiceTotal = 0;
    if (invoice.total !== undefined && invoice.total !== null) {
      try {
        if (typeof invoice.total === 'string') {
          invoiceTotal = parseFloat(invoice.total);
        } else if (typeof invoice.total === 'number') {
          invoiceTotal = invoice.total;
        }
        
        if (isNaN(invoiceTotal)) {
          console.error('Total de factura no es un número válido:', invoice.total);
          invoiceTotal = 0;
        }
      } catch (error) {
        console.error('Error al procesar total de factura:', error);
        invoiceTotal = 0;
      }
    }
    
    if (!supplierMap.has(supplierId)) {
      supplierMap.set(supplierId, {
        name: supplierName,
        identification: supplierId,
        totalAmount: 0,
        invoiceCount: 0
      });
    }
    
    const supplier = supplierMap.get(supplierId);
    supplier.totalAmount += invoiceTotal;
    supplier.invoiceCount += 1;
  });
  
  // Ordenar proveedores por monto total
  const topSuppliers = Array.from(supplierMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);
  
  // Agrupar por mes
  const monthMap = new Map();
  const shortMonthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  allInvoices.forEach((invoice: any) => {
    // Verificar que la fecha sea válida
    if (!invoice.date) return;
    
    try {
      const date = new Date(invoice.date);
      
      // Verificar que la fecha sea válida
      if (isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const monthName = shortMonthNames[date.getMonth()];
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthName,
          amount: 0,
          count: 0,
          key: monthKey
        });
      }
      
      const monthData = monthMap.get(monthKey);
      
      // Validar que el total sea un número
      let invoiceTotal = 0;
      if (invoice.total !== undefined && invoice.total !== null) {
        try {
          if (typeof invoice.total === 'string') {
            invoiceTotal = parseFloat(invoice.total);
          } else if (typeof invoice.total === 'number') {
            invoiceTotal = invoice.total;
          }
          
          if (isNaN(invoiceTotal)) {
            console.error('Total de factura no es un número válido:', invoice.total);
            invoiceTotal = 0;
          }
        } catch (error) {
          console.error('Error al procesar total de factura:', error);
          invoiceTotal = 0;
        }
      }
      
      monthData.amount += invoiceTotal;
      monthData.count += 1;
    } catch (error) {
      console.error('Error al procesar fecha de factura:', invoice.date, error);
    }
  });
  
  // Ordenar datos mensuales por fecha
  let monthlyData = Array.from(monthMap.values())
    .sort((a, b) => a.key.localeCompare(b.key));
  
  // Asegurar que tenemos datos para los últimos meses según el periodo
  const today = new Date();
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  // Crear un mapa con los meses existentes para búsqueda rápida
  const existingMonths = new Map(monthlyData.map(m => [m.key, m]));
  
  // Generar los últimos meses según el periodo
  const lastMonths = [];
  for (let i = monthsToGenerate - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = monthNames[date.getMonth()];
    
    lastMonths.push({
      month: monthName,
      amount: existingMonths.has(monthKey) ? existingMonths.get(monthKey).amount : 0,
      count: existingMonths.has(monthKey) ? existingMonths.get(monthKey).count : 0,
      key: monthKey
    });
  }
  
  // Asegurar que los datos mensuales tengan el formato correcto
  monthlyData = lastMonths.map(month => ({
    month: month.month,
    amount: Number(month.amount.toFixed(2)), // Asegurar 2 decimales
    count: month.count,
    key: month.key // Mantener la clave para referencia interna
  }));
  
  // Calcular crecimiento mensual (comparando el último mes con el anterior)
  let monthlyGrowth = 0;
  if (monthlyData.length >= 2) {
    try {
      // Validar que los montos sean números
      const currentAmount = typeof monthlyData[monthlyData.length - 1].amount === 'number' ? monthlyData[monthlyData.length - 1].amount : 0;
      const previousAmount = typeof monthlyData[monthlyData.length - 2].amount === 'number' ? monthlyData[monthlyData.length - 2].amount : 0;
      
      if (previousAmount > 0) {
        // Calcular crecimiento y limitar a 2 decimales
        monthlyGrowth = Number((((currentAmount - previousAmount) / previousAmount) * 100).toFixed(2));
      } else if (currentAmount > 0 && previousAmount === 0) {
        // Si el mes anterior fue 0 y el actual es positivo, considerar como 100% de crecimiento
        monthlyGrowth = 100;
      }
    } catch (error) {
      console.error('Error al calcular crecimiento mensual:', error);
      monthlyGrowth = 0;
    }
  }
  
  // Categorías (simuladas, ya que Siigo no proporciona categorías directamente)
  // En una implementación real, esto podría basarse en cuentas contables o etiquetas
  // Asegurar que totalAmount es un número válido
  const validTotalAmount = isNaN(totalAmount) ? 0 : totalAmount;
  
  const categoryBreakdown = [
    { category: 'Servicios Profesionales', amount: validTotalAmount * 0.35, percentage: 35 },
    { category: 'Materiales y Suministros', amount: validTotalAmount * 0.25, percentage: 25 },
    { category: 'Tecnología y Software', amount: validTotalAmount * 0.20, percentage: 20 },
    { category: 'Servicios Públicos', amount: validTotalAmount * 0.12, percentage: 12 },
    { category: 'Otros Gastos', amount: validTotalAmount * 0.08, percentage: 8 }
  ].map(category => ({
    ...category,
    // Redondear los montos a 2 decimales para evitar números muy largos
    amount: parseFloat(category.amount.toFixed(2))
  }));
  
  // Facturas recientes
  const recentInvoices = [...allInvoices]
    // Filtrar facturas con fechas válidas
    .filter((invoice: any) => {
      if (!invoice.date && !invoice.created) return false;
      try {
        const date = new Date(invoice.date || invoice.created);
        return !isNaN(date.getTime());
      } catch (error) {
        console.error('Error al validar fecha de factura:', invoice.date || invoice.created, error);
        return false;
      }
    })
    // Ordenar por fecha (más reciente primero)
    .sort((a: any, b: any) => {
      try {
        // Asegurarse de que las fechas sean objetos Date válidos
        let dateA = new Date(a.date || a.created);
        let dateB = new Date(b.date || b.created);
        
        // Verificar si las fechas son válidas
        if (isNaN(dateA.getTime())) {
          console.warn('Fecha inválida en factura A:', a.date || a.created);
          dateA = new Date(0); // Fecha muy antigua para que quede al final
        }
        
        if (isNaN(dateB.getTime())) {
          console.warn('Fecha inválida en factura B:', b.date || b.created);
          dateB = new Date(0); // Fecha muy antigua para que quede al final
        }
        
        return dateB.getTime() - dateA.getTime();
      } catch (error) {
        console.error('Error al ordenar facturas por fecha:', error);
        return 0; // En caso de error, no cambiar el orden
      }
    })
    .slice(0, 10) // Aumentamos a 10 facturas recientes
    .map((invoice: any) => {
      // Determinar el tipo basado en la fuente de datos
      const isVoucher = !invoice.document_type; // Corregimos la lógica
      
      // Formatear la fecha para mostrar
      let formattedDate = invoice.date || invoice.created || 'Fecha desconocida';
      try {
        const date = new Date(invoice.date || invoice.created);
        if (!isNaN(date.getTime())) {
          // Verificar si la fecha es hoy
          const today = new Date();
          const isToday = date.getDate() === today.getDate() &&
                          date.getMonth() === today.getMonth() &&
                          date.getFullYear() === today.getFullYear();
          
          if (isToday) {
            formattedDate = 'Hoy'; // Mostrar 'Hoy' para las facturas de hoy
          } else {
            formattedDate = date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
          }
        }
      } catch (error) {
        console.error('Error al formatear fecha:', invoice.date || invoice.created, error);
      }
      
      // Validar el monto
      let amount = 0;
      if (typeof invoice.total === 'number') {
        amount = invoice.total;
      } else if (typeof invoice.total === 'string') {
        try {
          amount = parseFloat(invoice.total);
          if (isNaN(amount)) amount = 0;
        } catch (error) {
          console.error('Error al convertir monto de factura:', invoice.total, error);
          amount = 0;
        }
      }
      
      // Determinar el estado
      let status: 'success' | 'pending' | 'error' = 'success';
      if (invoice.status) {
        const statusLower = typeof invoice.status === 'string' ? invoice.status.toLowerCase() : invoice.status;
        if (statusLower === 'error' || statusLower === 'rejected' || statusLower === 'cancelled') {
          status = 'error';
        } else if (statusLower === 'pending' || statusLower === 'draft' || statusLower === 'in_progress') {
          status = 'pending';
        }
      }
      
      return {
        id: invoice.id || invoice.document_id || invoice.number || 'Sin ID',
        date: formattedDate,
        supplier: invoice.supplier?.name || invoice.third_party?.name || 'Proveedor Desconocido',
        amount: amount,
        status: status,
        type: isVoucher ? 'Gasto' : 'Compra'
      };
    });
  
  return {
    totalInvoices,
    totalAmount,
    averageAmount,
    monthlyGrowth,
    topSuppliers,
    monthlyData,
    categoryBreakdown,
    recentInvoices
  };
}

// Función principal para obtener analytics
export async function obtenerAnalyticsSiigo(periodo: string = '6m'): Promise<InvoiceAnalytics> {
  console.log(`🔄 Obteniendo analytics para el período: ${periodo}`);
  
  try {
    // Validar el parámetro de período
    if (!['today', '1m', '3m', '6m', '1y'].includes(periodo)) {
      console.warn(`❌ Período no válido: ${periodo}. Usando valor por defecto '6m'`);
      periodo = '6m';
    }

    // Obtener token de autenticación
    console.log('🔑 Obteniendo token de autenticación...');
    const token = await obtenerTokenSiigo();
    if (!token) {
      throw new Error('No se pudo obtener el token de autenticación de Siigo');
    }
    
    // Calcular fechas según el periodo seleccionado
    const today = new Date();
    const endDate = today.toISOString().split('T')[0]; // Hoy
    let startDate: string;
    let monthsToGenerate = 6; // Por defecto 6 meses
    
    // Calcular fechas según el período seleccionado
    switch (periodo) {
      case 'today': {
        startDate = endDate;
        monthsToGenerate = 1;
        console.log(`📅 Período: Hoy (${startDate})`);
        break;
      }
      case '1m': {
        const date = new Date(today);
        date.setMonth(date.getMonth() - 1);
        startDate = date.toISOString().split('T')[0];
        monthsToGenerate = 1;
        console.log(`📅 Período: Último mes (${startDate} - ${endDate})`);
        break;
      }
      case '3m': {
        const date = new Date(today);
        date.setMonth(date.getMonth() - 3);
        startDate = date.toISOString().split('T')[0];
        monthsToGenerate = 3;
        console.log(`📅 Período: Últimos 3 meses (${startDate} - ${endDate})`);
        break;
      }
      case '1y': {
        const date = new Date(today);
        date.setFullYear(date.getFullYear() - 1);
        startDate = date.toISOString().split('T')[0];
        monthsToGenerate = 12;
        console.log(`📅 Período: Último año (${startDate} - ${endDate})`);
        break;
      }
      case '6m':
      default: {
        const date = new Date(today);
        date.setMonth(date.getMonth() - 6);
        startDate = date.toISOString().split('T')[0];
        monthsToGenerate = 6;
        console.log(`📅 Período: Últimos 6 meses (${startDate} - ${endDate})`);
        break;
      }
    }
    
    // Obtener facturas de Siigo
    console.log('📊 Obteniendo facturas de Siigo...');
    const facturas = await obtenerFacturasSiigo(token, startDate, endDate);
    
    // Validar que se obtuvieron facturas
    if (!facturas || (!facturas.purchases?.length && !facturas.vouchers?.length)) {
      console.warn('⚠️ No se encontraron facturas en el período seleccionado');
      // Devolver estructura vacía en lugar de lanzar error
      return {
        totalInvoices: 0,
        totalAmount: 0,
        averageAmount: 0,
        monthlyGrowth: 0,
        topSuppliers: [],
        monthlyData: [],
        categoryBreakdown: [],
        recentInvoices: []
      };
    }
    
    // Procesar datos para generar analytics
    console.log('📈 Procesando datos de facturas...');
    const analytics = procesarDatosFacturas(facturas, monthsToGenerate);
    
    // Validar y formatear los datos de salida
    const result: InvoiceAnalytics = {
      totalInvoices: analytics.totalInvoices || 0,
      totalAmount: analytics.totalAmount || 0,
      averageAmount: analytics.averageAmount || 0,
      monthlyGrowth: analytics.monthlyGrowth || 0,
      topSuppliers: Array.isArray(analytics.topSuppliers) ? analytics.topSuppliers : [],
      monthlyData: (Array.isArray(analytics.monthlyData) ? analytics.monthlyData : []).map(item => ({
        month: String(item.month || ''),
        amount: Number(item.amount || 0),
        count: Number(item.count || 0)
      })),
      categoryBreakdown: (Array.isArray(analytics.categoryBreakdown) ? analytics.categoryBreakdown : []).map(item => ({
        category: String(item.category || ''),
        amount: Number(item.amount || 0),
        percentage: Number(item.percentage || 0)
      })),
      recentInvoices: (Array.isArray(analytics.recentInvoices) ? analytics.recentInvoices : []).map(invoice => ({
        id: String(invoice.id || ''),
        date: String(invoice.date || ''),
        supplier: String(invoice.supplier || ''),
        amount: Number(invoice.amount || 0),
        status: invoice.status === 'success' || invoice.status === 'pending' || invoice.status === 'error' 
          ? invoice.status 
          : 'pending',
        type: invoice.type === 'Gasto' || invoice.type === 'expense' ? 'expense' : 'purchase'
      }))
    };
    
    console.log('✅ Análisis completado exitosamente');
    return result;
  } catch (error: any) {
    console.error('❌ Error al obtener analytics de Siigo:', {
      message: error.message,
      stack: error.stack,
      ...(error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : {})
    });
    
    // En caso de error, devolver datos vacíos
    const errorMessage = error.response?.data?.error || error.message || 'Error desconocido';
    console.error('❌ Error en obtenerAnalyticsSiigo:', errorMessage);
    
    // Crear datos vacíos para el período actual
    const today = new Date();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyData: { month: string; amount: number; count: number }[] = [];
    
    // Determinar cuántos meses generar según el período
    const monthsCount = periodo === 'today' ? 1 : 
                       periodo === '1m' ? 1 : 
                       periodo === '3m' ? 3 : 
                       periodo === '1y' ? 12 : 6;
    
    // Generar datos mensuales vacíos
    for (let i = monthsCount - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = monthNames[date.getMonth()];
      
      monthlyData.push({
        month: monthName,
        amount: 0,
        count: 0
      });
    }
    
    // Devolver estructura vacía con tipos correctos
    return {
      totalInvoices: 0,
      totalAmount: 0,
      averageAmount: 0,
      monthlyGrowth: 0,
      topSuppliers: [],
      monthlyData,
      categoryBreakdown: [],
      recentInvoices: []
    };
  }
}