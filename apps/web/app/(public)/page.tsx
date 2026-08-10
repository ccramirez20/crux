import Link from 'next/link';
import { TopographicMotif } from '@/components/topographic-motif';
import { primaryButtonClass } from '@/lib/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="w-full max-w-xl">
        <TopographicMotif />
      </div>

      <div className="flex w-full max-w-xl flex-col gap-4">
        <span className="font-display text-lg font-bold tracking-wide text-pine">CRUX</span>
        <h1 className="font-display text-4xl font-bold leading-tight">
          Compite, no lleves cuentas en papel.
        </h1>
        <p className="text-base text-muted">
          Crux corre competencias de escalada de principio a fin: inscripciones por enlace, jueces
          que registran desde el teléfono aunque se caiga el wifi, y resultados que se actualizan
          solos.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Link href="/sign-in" className={primaryButtonClass}>
            Entrar como organizador
          </Link>
          <span className="text-sm text-muted">
            ¿Vas a competir? Quien organiza te pasa el enlace de inscripción.
          </span>
        </div>
      </div>
    </main>
  );
}
