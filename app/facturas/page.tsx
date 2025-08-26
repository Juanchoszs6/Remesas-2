import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SiigoInvoiceForm from '../../formulario-facturas';

export default async function InvoicePage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login?redirect=/facturas');
  }
  
  return (
    <div>
      <SiigoInvoiceForm />
    </div>
  );
}
