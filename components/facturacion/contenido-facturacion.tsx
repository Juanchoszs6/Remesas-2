'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LogOut, 
  FileText, 
  DollarSign, 
  Users, 
  BarChart3, 
  ArrowLeft, 
  Shield, 
  TrendingUp, 
  TrendingDown,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface BillingContentProps {
  user: User;
}

interface InvoiceAnalytics {
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

export default function BillingContent({ user }: BillingContentProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [analytics, setAnalytics] = useState<InvoiceAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_activeTab, _setActiveTab] = useState('overview');
  const [_timeRange, _setTimeRange] = useState('month');
  const [_selectedSupplier, _setSelectedSupplier] = useState<{ id: string; name: string } | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('6m');
  const router = useRouter();

  // Función para cargar datos de analytics desde SIIGO
  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Cargando analytics de facturas SIIGO...');
      
      // Validar que el periodo sea válido
      if (!['today', '1m', '3m', '6m', '1y'].includes(selectedPeriod)) {
        throw new Error('Periodo no válido');
      }
      
      // Obtener datos reales desde la API
      const response = await fetch(`/api/siigo/invoices/analytics?periodo=${selectedPeriod}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Error al obtener datos de analytics');
        } catch {
          throw new Error(`Error al cargar datos: ${response.status} - ${errorText}`);
        }
      }
      
      const responseData = await response.json();
      
      // Validar que la respuesta tenga la estructura esperada
      if (!responseData || typeof responseData !== 'object') {
        throw new Error('Formato de respuesta inválido');
      }
      
      // Asegurarse de que los datos tengan la estructura correcta
      const analyticsData: InvoiceAnalytics = {
        totalInvoices: responseData.totalInvoices || 0,
        totalAmount: responseData.totalAmount || 0,
        averageAmount: responseData.averageAmount || 0,
        monthlyGrowth: responseData.monthlyGrowth || 0,
        topSuppliers: Array.isArray(responseData.topSuppliers) ? responseData.topSuppliers : [],
        monthlyData: Array.isArray(responseData.monthlyData) ? responseData.monthlyData : [],
        categoryBreakdown: Array.isArray(responseData.categoryBreakdown) ? responseData.categoryBreakdown : [],
        recentInvoices: Array.isArray(responseData.recentInvoices) ? responseData.recentInvoices : []
      };
      
      setAnalytics(analyticsData);
      toast.success('Analytics cargados exitosamente');
    } catch (error: unknown) {
      console.error('Error al cargar analytics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar los datos';
      toast.error(`Error al cargar los datos de analytics: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      const response = await fetch('/api/autenticacion/cerrar-sesion', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al cerrar sesión');
      }

      // Redirigir al login
      router.push('/login');
      router.refresh();
    } catch (error: unknown) {
      console.error('Error al cerrar sesión:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al cerrar sesión: ${errorMessage}`);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Cargar analytics al montar el componente
  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const userInitials = user.email.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/panel')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Volver al Panel</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <h1 className="text-2xl font-bold text-gray-900">
                Analytics SIIGO - Panel de Facturación
              </h1>
              <Badge variant="destructive" className="flex items-center space-x-1">
                <Shield className="h-3 w-3" />
                <span>Área Protegida</span>
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Avatar>
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700">
                  {user.email}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>{isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión'}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Cargando Analytics SIIGO</h3>
              <p className="text-gray-600">Analizando datos de facturas y gastos...</p>
            </div>
          </div>
        ) : analytics ? (
          <>
            {/* Controls */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAnalytics}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Actualizar</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar</span>
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select 
                  value={selectedPeriod} 
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="border rounded px-3 py-1 text-sm"
                >
                  <option value="today">Hoy</option>
                  <option value="1m">Último mes</option>
                  <option value="3m">Últimos 3 meses</option>
                  <option value="6m">Últimos 6 meses</option>
                  <option value="1y">Último año</option>
                </select>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              
              {/* Total Amount */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${analytics.totalAmount.toLocaleString('es-CO')}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center">
                    {analytics.monthlyGrowth >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1 text-red-600" />
                    )}
                    {analytics.monthlyGrowth >= 0 ? '+' : ''}{analytics.monthlyGrowth.toFixed(1)}% desde el mes pasado
                  </p>
                </CardContent>
              </Card>

              {/* Total Invoices */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Facturas</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalInvoices}</div>
                  <p className="text-xs text-muted-foreground">
                    Facturas de compra y gastos
                  </p>
                </CardContent>
              </Card>

              {/* Average Amount */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Promedio por Factura</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${analytics.averageAmount.toLocaleString('es-CO')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Valor promedio
                  </p>
                </CardContent>
              </Card>

              {/* Top Suppliers */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Proveedores Activos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.topSuppliers.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Proveedores principales
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Analytics Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Resumen</TabsTrigger>
                <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
                <TabsTrigger value="categories">Categorías</TabsTrigger>
                <TabsTrigger value="recent">Recientes</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Monthly Trend */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5" />
                        <span>Tendencia Mensual</span>
                      </CardTitle>
                      <CardDescription>
                        Evolución de facturas por mes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {analytics.monthlyData.map((month, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 text-sm font-medium">{month.month}</div>
                              <div className="flex-1">
                                <Progress 
                                  value={month.amount > 0 ? 
                                    (month.amount / Math.max(...analytics.monthlyData.filter(m => m.amount > 0).map(m => m.amount))) * 100 : 0} 
                                  className="h-2"
                                />
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                ${month.amount.toLocaleString('es-CO')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {month.count} facturas
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Status Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Package className="h-5 w-5" />
                        <span>Estado de Facturas</span>
                      </CardTitle>
                      <CardDescription>
                        Distribución por estado
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Calcular estadísticas de estado */}
                      {(() => {
                        // Contar facturas por estado
                        const successCount = analytics.recentInvoices.filter(inv => inv.status === 'success').length;
                        const pendingCount = analytics.recentInvoices.filter(inv => inv.status === 'pending').length;
                        const errorCount = analytics.recentInvoices.filter(inv => inv.status === 'error').length;
                        const totalCount = analytics.recentInvoices.length;
                        
                        // Calcular porcentajes
                        const successPercent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
                        const pendingPercent = totalCount > 0 ? Math.round((pendingCount / totalCount) * 100) : 0;
                        const errorPercent = totalCount > 0 ? Math.round((errorCount / totalCount) * 100) : 0;
                        
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm">Exitosas</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{successCount}</div>
                                <div className="text-xs text-gray-500">{successPercent}%</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-yellow-600" />
                                <span className="text-sm">Pendientes</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{pendingCount}</div>
                                <div className="text-xs text-gray-500">{pendingPercent}%</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <span className="text-sm">Con errores</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{errorCount}</div>
                                <div className="text-xs text-gray-500">{errorPercent}%</div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Suppliers Tab */}
              <TabsContent value="suppliers">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Proveedores</CardTitle>
                    <CardDescription>
                      Proveedores con mayor volumen de facturación
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.topSuppliers.map((supplier, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                            </div>
                            <div>
                              <div className="font-medium">{supplier.name}</div>
                              <div className="text-sm text-gray-500">{supplier.identification}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              ${supplier.totalAmount.toLocaleString('es-CO')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {supplier.invoiceCount} facturas
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Categories Tab */}
              <TabsContent value="categories">
                <Card>
                  <CardHeader>
                    <CardTitle>Análisis por Categorías</CardTitle>
                    <CardDescription>
                      Distribución de gastos por categoría
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.categoryBreakdown.map((category, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{category.category}</span>
                            <span className="text-sm text-gray-500">{category.percentage}%</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Progress value={category.percentage} className="flex-1" />
                            <span className="text-sm font-medium min-w-[100px] text-right">
                              ${category.amount.toLocaleString('es-CO')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Recent Tab */}
              <TabsContent value="recent">
                <Card>
                  <CardHeader>
                    <CardTitle>Facturas Recientes</CardTitle>
                    <CardDescription>
                      Últimas facturas procesadas en SIIGO
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.recentInvoices.map((invoice, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className={`w-3 h-3 rounded-full ${
                              invoice.status === 'success' ? 'bg-green-500' :
                              invoice.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                            <div>
                              <div className="font-medium">{invoice.id}</div>
                              <div className="text-sm text-gray-500">{invoice.supplier}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              ${invoice.amount.toLocaleString('es-CO')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {invoice.date} • {invoice.type === 'purchase' ? 'Compra' : 'Gasto'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No se pudieron cargar los datos</h3>
            <p className="text-gray-600 mb-4">Hubo un problema al cargar los analytics de SIIGO</p>
            <Button onClick={loadAnalytics} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
