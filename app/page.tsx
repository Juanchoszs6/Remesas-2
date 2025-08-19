import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function Page() {
  const user = await getCurrentUser();
  
  if (!user) {
    // Si no hay usuario autenticado, redirigir al login
    redirect('/login');
  }
  
  // Si hay usuario autenticado, redirigir al dashboard
  redirect('/dashboard');
}
