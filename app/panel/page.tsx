import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ContenidoPanel from '@/components/panel/contenido-panel';

export default async function PanelPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  return <ContenidoPanel user={user} />;
}
