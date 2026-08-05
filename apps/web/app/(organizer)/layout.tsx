import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getAuth } from '@/lib/auth';

// This guards page rendering only. A Server Action or Route Handler defined
// under (organizer)/ is invoked directly, not through this layout — it must
// call getAuth().api.getSession() itself before mutating anything.
export default async function OrganizerLayout({ children }: { children: ReactNode }) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/sign-in');
  }
  return <>{children}</>;
}
