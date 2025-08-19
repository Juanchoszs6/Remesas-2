import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import DashboardContent from '@/components/dashboard/DashboardContent';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  return <DashboardContent user={user} />;
}
