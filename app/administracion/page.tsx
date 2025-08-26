import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminContent from '@/components/administracion/contenido-administracion';

export default async function AdminPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login?redirect=/administracion');
  }
  
  return <AdminContent user={user} />;
}
