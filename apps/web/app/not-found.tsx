import Link from 'next/link';
import { TopographicMotif } from '@/components/topographic-motif';
import { brandWordClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui';

/**
 * Hasta hoy un enlace roto caía en el 404 de Next: "This page could not be
 * found", en inglés, sobre fondo blanco y sin una sola pieza del diseño.
 *
 * No es una pantalla rara. Es donde aterriza quien escribe mal el slug de un
 * evento —`/resultados/liga-paramos`— o quien recibe por WhatsApp un enlace
 * cortado, que es exactamente lo que pasa el día de la competencia, con la
 * sala llena y sin nadie a quien preguntarle. La salida no puede ser un
 * callejón: los dos botones llevan a donde de verdad querían ir.
 *
 * Sin `<main>` propio del layout raíz porque no hay: cada pantalla arma el
 * suyo, y esta hace lo mismo.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-8 px-4 py-12">
      <TopographicMotif />

      <div className="flex flex-col gap-3">
        <span className={`${brandWordClass} text-lg`}>CRUX</span>
        <h1 className="font-display text-3xl font-bold md:text-4xl">
          Esta página no existe
        </h1>
        <p className="max-w-[52ch] text-lg leading-relaxed text-muted">
          Puede que el enlace venga cortado, o que la dirección tenga una letra de más. Los enlaces
          de una competencia llevan siempre su nombre al final:
        </p>
        {/* En renglón aparte: dentro del párrafo se partía a mitad de frase a
            390 px y el punto final quedaba flotando después del recuadro. */}
        <code className="w-fit rounded bg-stone px-3 py-2 text-base">
          /resultados/copa-suesca
        </code>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link href="/" className={primaryButtonClass}>
          Ir al inicio
        </Link>
        <Link href="/sign-in" className={secondaryButtonClass}>
          Entrar como organizador
        </Link>
      </div>

      <p className="text-sm text-muted">
        ¿Buscabas una competencia y el enlace no sirve? Escríbele a quien organiza, o a{' '}
        <a
          href="mailto:contacto@cruxcompetencias.com"
          className="font-medium text-pine underline"
        >
          contacto@cruxcompetencias.com
        </a>
        .
      </p>
    </main>
  );
}
