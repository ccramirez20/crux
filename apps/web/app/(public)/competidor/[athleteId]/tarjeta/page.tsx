import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { buildShareCard } from '@/lib/share-card';
import { brandWordClass } from '@/lib/ui';

// Misma regla que /competidor: no entra a Google. Bloqueada además a menores
// de edad — `buildShareCard` decide, esta página solo obedece.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ evento?: string }>;
}): Promise<Metadata> {
  const { athleteId } = await params;
  const { evento } = await searchParams;
  const imageUrl = evento ? `/api/tarjeta/${athleteId}?evento=${evento}` : undefined;
  return {
    title: 'Tarjeta de competencia · Crux',
    robots: { index: false, follow: false },
    openGraph: imageUrl ? { images: [imageUrl] } : undefined,
  };
}

export default async function TarjetaPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ evento?: string }>;
}) {
  const { athleteId } = await params;
  const { evento } = await searchParams;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(athleteId)) {
    notFound();
  }
  if (!evento) {
    redirect(`/competidor/${athleteId}`);
  }

  const result = await buildShareCard(athleteId, evento);
  if (!result.ok) {
    redirect(`/competidor/${athleteId}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center gap-6 px-4 py-12 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada por la ruta /api/tarjeta, no un asset local que next/image pueda optimizar */}
      <img
        src={`/api/tarjeta/${athleteId}?evento=${evento}`}
        alt={`Tarjeta de ${result.card.athleteName} en ${result.card.eventName}`}
        width={1080}
        height={1920}
        className="w-full max-w-xs rounded-lg border border-cardborder shadow-lg"
      />
      <p className="text-base text-muted">
        Mantén pulsada la imagen para guardarla, o haz click derecho sobre ella en el computador.
      </p>
      <a
        href={`/competidor/${athleteId}`}
        className="font-display text-lg font-semibold text-pine underline decoration-gold decoration-2 underline-offset-4"
      >
        Ver historial completo →
      </a>
      <p className="mt-4 text-sm text-muted">
        <a href="/" className={`${brandWordClass} underline decoration-gold decoration-2 underline-offset-4`}>
          CRUX
        </a>
        , plataforma de competencias de escalada.
      </p>
    </main>
  );
}
