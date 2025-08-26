'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LogOut, Shield, Users, Settings, Database, Key, ArrowLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface AdminContentProps {
  user: User;
}

export default function AdminContent({ user }: AdminContentProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

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
                Panel de Administración
              </h1>
              <Badge variant="destructive" className="flex items-center space-x-1">
                <Lock className="h-3 w-3" />
                <span>Área Ultra Protegida</span>
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
        
        {/* Security Alert */}
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Lock className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">Área de Administración Crítica</h3>
                <p className="text-red-700 text-sm">
                  Esta es la sección más protegida del sistema. Solo administradores autenticados 
                  pueden acceder a esta área. El middleware verifica automáticamente las credenciales.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Panel Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          
          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Gestión de Usuarios</span>
              </CardTitle>
              <CardDescription>
                Administra usuarios del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Usuarios Totales:</span>
                <Badge variant="secondary">1</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Usuarios Activos:</span>
                <Badge variant="default" className="bg-green-100 text-green-800">1</Badge>
              </div>
              <Button className="w-full" variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Ver Todos los Usuarios
              </Button>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Configuración de Seguridad</span>
              </CardTitle>
              <CardDescription>
                Ajustes de autenticación y seguridad
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Middleware:</span>
                <Badge variant="default" className="bg-green-100 text-green-800">Activo</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Sesiones:</span>
                <Badge variant="secondary">Seguras</Badge>
              </div>
              <Button className="w-full" variant="outline" size="sm">
                <Shield className="h-4 w-4 mr-2" />
                Configurar Seguridad
              </Button>
            </CardContent>
          </Card>

          {/* Database Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Estado de la Base de Datos</span>
              </CardTitle>
              <CardDescription>
                Información de Neon Database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Conexión:</span>
                <Badge variant="default" className="bg-green-100 text-green-800">Conectada</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tablas:</span>
                <Badge variant="secondary">users, sessions</Badge>
              </div>
              <Button className="w-full" variant="outline" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Ver Base de Datos
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Admin Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* System Administration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Administración del Sistema</span>
              </CardTitle>
              <CardDescription>
                Herramientas administrativas avanzadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start" size="lg" variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Gestionar Usuarios y Permisos
              </Button>
              <Button className="w-full justify-start" size="lg" variant="outline">
                <Database className="h-4 w-4 mr-2" />
                Administrar Base de Datos
              </Button>
              <Button className="w-full justify-start" size="lg" variant="outline">
                <Shield className="h-4 w-4 mr-2" />
                Configurar Autenticación
              </Button>
              <Button className="w-full justify-start" size="lg" variant="outline">
                <Key className="h-4 w-4 mr-2" />
                Gestionar Sesiones Activas
              </Button>
            </CardContent>
          </Card>

          {/* Authentication Status */}
          <Card>
            <CardHeader>
              <CardTitle>Estado de Autenticación</CardTitle>
              <CardDescription>
                Información detallada del sistema de auth
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-900">Middleware Activo</span>
                  </div>
                  <p className="text-sm text-green-700">
                    El middleware protege automáticamente las rutas /dashboard, /admin, /facturacion, /billing
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Key className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Sesión Segura</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Tu sesión está encriptada y almacenada de forma segura con tokens únicos
                  </p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Database className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-purple-900">Base de Datos Neon</span>
                  </div>
                  <p className="text-sm text-purple-700">
                    Usuarios y sesiones almacenados de forma segura en Neon PostgreSQL
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Information */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                🔐 Panel de Administración Ultra Protegido
              </h2>
              <p className="text-gray-600 max-w-4xl mx-auto">
                Has accedido exitosamente al área más protegida del sistema. Esta página administrativa 
                está completamente blindada por el middleware de autenticación. Solo usuarios con 
                credenciales válidas pueden ver este contenido. El sistema verifica automáticamente 
                la autenticación en cada solicitud y redirige a los usuarios no autenticados al login.
              </p>
              <div className="mt-4 flex justify-center space-x-4">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  ✓ Autenticado
                </Badge>
                <Badge variant="default" className="bg-blue-100 text-blue-800">
                  ✓ Middleware Activo
                </Badge>
                <Badge variant="default" className="bg-purple-100 text-purple-800">
                  ✓ Sesión Válida
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
