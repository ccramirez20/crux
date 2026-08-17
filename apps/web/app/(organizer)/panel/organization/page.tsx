import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, organizations } from '@crux/db';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { TopographicMotif } from '@/components/topographic-motif';
import { cardClass, eyebrowClass } from '@/lib/ui';
import { ORGANIZATION_COOKIE, resolveSelectedOrganization } from '@/lib/organizations';
import { OrganizationLogoForm } from './organization-form';

export default async function OrganizationPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const ownerId = session?.user.id ?? '';
  const db = getDb();

  const myOrganizations = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      location: organizations.location,
      logo: organizations.logo,
    })
    .from(organizations)
    .where(eq(organizations.ownerId, ownerId))
    .orderBy(organizations.createdAt);
  const selected = resolveSelectedOrganization(
    myOrganizations,
    (await cookies()).get(ORGANIZATION_COOKIE)?.value,
  );
  if (!selected) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <TopographicMotif />
      <div>
        <Link href="/panel" className="text-sm text-pine underline">
          ← Tus eventos
        </Link>
        <span className={`${eyebrowClass} mt-4 block`}>Organización</span>
        <h1 className="mt-1 font-display text-3xl font-bold">{selected.name}</h1>
        <p className="mt-1 text-sm text-muted">{selected.location}</p>
      </div>
      <section className={cardClass}>
        <OrganizationLogoForm organizationId={selected.id} logo={selected.logo} />
      </section>
    </main>
  );
}
