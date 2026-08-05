import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, organizations } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { CreateEventForm } from './create-event-form';

export default async function NewEventPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/sign-in');
  }

  const ownedOrganizations = await getDb()
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.ownerId, session.user.id));

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-4 py-12">
      <div className="w-full max-w-sm">
        <TopographicMotif />
      </div>
      <CreateEventForm organizations={ownedOrganizations} />
    </main>
  );
}
