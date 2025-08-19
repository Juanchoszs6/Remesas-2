import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminContent from '@/components/admin/AdminContent';

export default async function AdminPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login?redirect=/admin');
  }
  
  return <AdminContent user={user} />;
}
