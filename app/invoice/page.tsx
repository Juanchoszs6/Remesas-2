import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SiigoInvoiceForm from '../../invoice-form';

export default async function InvoicePage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login?redirect=/invoice');
  }
  
  return (
    <div>
      <SiigoInvoiceForm />
    </div>
  );
}
