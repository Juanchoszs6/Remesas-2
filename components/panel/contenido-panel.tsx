'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LogOut, User as UserIcon, Mail, Calendar, Shield, FileText, Upload, Search } from 'lucide-react';
import { toast } from 'sonner';
import { FileUpload } from '../analiticas/subir-archivo';
import { AnalyticsChart, type DocumentType, type TimeRange } from '../analiticas/AnalyticsChart';

interface User {
  email: string;
  created_at: string;
  role?: string;
  // Agregar otras propiedades de usuario según sea necesario
}

interface DashboardContentProps {
  user: User;
}

export default function DashboardContent({ user }: DashboardContentProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('FC');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();

  const handleFileProcessed = (data: {
    success: boolean;
    totalValue?: number;
    documentType: DocumentType;
    processedRows?: number;
    timeRange?: TimeRange;
    shouldRefresh?: boolean;
  }) => {
    console.log('Archivo procesado:', data);
    if (data.success) {
      // Actualizar el tipo de documento si es diferente
      if (data.documentType && data.documentType !== documentType) {
        setDocumentType(data.documentType);
      }
      
      // Actualizar el rango de tiempo si está disponible
      if (data.timeRange && data.timeRange !== timeRange) {
        setTimeRange(data.timeRange);
      }
      
      // Actualizar el valor total si está disponible
      if (typeof data.totalValue === 'number') {
        setTotalValue(data.totalValue);
      }
      
      // Forzar actualización del gráfico si es necesario
      if (data.shouldRefresh) {
        setRefreshKey(prev => prev + 1);
      }
      
      // Mostrar notificación de éxito
      toast.success(
        `Archivo procesado correctamente. ${data.processedRows || 0} filas procesadas.`
      );
      
      // Mostrar notificación con el total si está disponible
      if (data.totalValue) {
        setTotalValue(data.totalValue);
        const docTypeName = getDocumentTypeName(data.documentType);
        toast.success(`${docTypeName} procesadas correctamente. Valor total: $${data.totalValue.toLocaleString()}`);
      }
      
      // Forzar actualización del gráfico
      setRefreshKey(prev => prev + 1);
    }
  };

  const getDocumentTypeName = (type: string) => {
    const types: Record<string, string> = {
      'FC': 'Facturas de Compra',
      'ND': 'Notas Débito',
      'DS': 'Documentos Soporte',
      'RP': 'Recibos de Pago'
    };
    return types[type] || 'Documentos';
  };

  const getTimeRangeName = (range: TimeRange) => {
    const ranges: Record<TimeRange, string> = {
      'day': 'Diario',
      'week': 'Semanal',
      'month': 'Mensual',
      'quarter': 'Trimestral',
      'year': 'Anual'
    };
    return ranges[range] || range;
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      const response = await fetch('/api/autenticacion/cerrar-sesion', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Sesión cerrada exitosamente');
        router.push('/login');
        router.refresh();
      } else {
        throw new Error('Error al cerrar sesión');
      }
    } catch (error) {
      toast.error('Error al cerrar sesión');
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const userInitials = user?.email?.charAt(0).toUpperCase() || 'U';
  const joinDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Fecha no disponible';
  
  // Límite de error para la representación
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error de autenticación</h2>
          <p className="text-gray-600 mb-4">No se pudo cargar la información del usuario.</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Recargar página
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Encabezado */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Panel de Administración
              </h1>
              <Badge variant="secondary" className="flex items-center space-x-1">
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

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Sección de Tarjetas de Usuario */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserIcon className="h-5 w-5" />
                <span>Perfil de Usuario</span>
              </CardTitle>
              <CardDescription>
                Información de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900">{user.email}</p>
                  <p className="text-sm text-gray-500">Usuario Administrador</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{user.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Miembro desde:</span>
                  <span className="font-medium">{joinDate}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta de Acciones Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Acciones Rápidas</span>
              </CardTitle>
              <CardDescription>
                Accede a las funciones principales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start" 
                variant="default"
                onClick={() => router.push('/facturas')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Formulario SIIGO
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push('/consultar-facturas')}
              >
                <Search className="h-4 w-4 mr-2" />
                Consultar Facturas
              </Button>
            </CardContent>
          </Card>

          {/* Tarjeta de Estado del Sistema */}
          <div className="grid gap-4">
            {totalValue !== null && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Resumen de la Carga</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <h3 className="text-sm font-medium text-muted-foreground">Valor Total</h3>
                      <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Estado del Sistema</CardTitle>
                <CardDescription>
                  Información del sistema de autenticación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Estado de Sesión:</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Activa
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Tipo de Usuario:</span>
                  <Badge variant="secondary">
                    Administrador
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Autenticación:</span>
                  <Badge variant="default" className="bg-blue-100 text-blue-800">
                    Verificada
                  </Badge>
                </div>
                <Separator />
                <p className="text-xs text-gray-500">
                  Tu sesión está protegida y todas las rutas administrativas 
                  requieren autenticación válida.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sección de Carga de Archivos */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Análisis de Datos</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Cargar Archivos de Análisis</span>
              </CardTitle>
              <CardDescription>
                Sube archivos Excel para análisis mensual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload 
                documentType={documentType}
                timeRange={timeRange}
                onFileProcessed={handleFileProcessed}
                onUploadComplete={() => {
                  toast.success('Carga de archivos completada');
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sección de Análisis */}
        <div className="space-y-6 pb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800">Análisis de Datos</h2>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <label htmlFor="documentType" className="text-sm font-medium text-gray-700">Tipo de Documento:</label>
                <select
                  id="documentType"
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                >
                  <option value="FC">Facturas de Compra</option>
                  <option value="ND">Notas Débito</option>
                  <option value="DS">Documentos Soporte</option>
                  <option value="RP">Recibos de Pago</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <label htmlFor="timeRange" className="text-sm font-medium text-gray-700">Periodo:</label>
                <select
                  id="timeRange"
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                >
                  <option value="day">Diario</option>
                  <option value="week">Semanal</option>
                  <option value="month">Mensual</option>
                  <option value="quarter">Trimestral</option>
                  <option value="year">Anual</option>
                </select>
              </div>
            </div>
          </div>
          
          <Card className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-lg">Resumen de {getDocumentTypeName(documentType)}</CardTitle>
              <CardDescription className="text-sm">
                Visualización de datos por {getTimeRangeName(timeRange).toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full" style={{ minHeight: '500px' }}>
                <div key={`${documentType}-${timeRange}-${refreshKey}`} className="w-full">
                  <AnalyticsChart 
                    title={`${getDocumentTypeName(documentType)}`}
                    documentType={documentType}
                    timeRange={timeRange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}