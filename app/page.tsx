// Importaciones de Next.js y utilidades de autenticación
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

/**
 * Página principal de la aplicación
 * - Redirige a los usuarios no autenticados a la página de inicio de sesión
 * - Redirige a los usuarios autenticados al panel de control
 */
export default async function Page() {
  // Obtener el usuario actual de la sesión
  const user = await getCurrentUser();
  
  // Verificar si el usuario está autenticado
  if (!user) {
    // Redirigir a la página de inicio de sesión si no hay usuario autenticado
    redirect('/login');
  }
  
  // Redirigir al panel de control si el usuario está autenticado
  redirect('/panel');
}
