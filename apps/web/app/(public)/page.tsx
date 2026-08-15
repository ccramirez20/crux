import type { Metadata } from 'next';
import Link from 'next/link';
import { StandingsMotif } from '@/components/standings-motif';
import { TopographicMotif } from '@/components/topographic-motif';
import { brandWordClass, eyebrowClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui';
import { HEADLINE, HEADLINE_LINES } from '@/lib/labels';

// Local a la portada, no el `eyebrowClass` compartido: aquí encabezan una
// sección entera y a 11px se perdían. Mismo peso y tracking que el rótulo de
// la tabla pública, una talla más grande.
const sectionEyebrowClass = 'text-sm font-semibold uppercase tracking-[0.14em] text-muted';

export const metadata: Metadata = {
  title: 'Crux — Competencias de escalada',
  description:
    'Inscripción por enlace, jueces que puntúan desde el celular aunque se caiga el wifi, y una tabla pública que se actualiza sola.',
  openGraph: {
    title: 'Crux — Competencias de escalada',
    description: HEADLINE,
    locale: 'es_CO',
    type: 'website',
  },
};

/** El enlace vive aquí y no suelto en cada sección: es el argumento de venta. */
const DEMO_BOARD = '/resultados/liga-paramo';

/**
 * Correo del proyecto, no una dirección personal: lo que se publica en una
 * página abierta no se deshace, y una cuenta propia se puede pasar a otra
 * persona el día que alguien más responda los correos.
 *
 * Provisional hasta que haya dominio, y entonces esto pasa a algo como
 * hola@crux.co — es el único sitio del código donde vive, así que cambiarlo es
 * una línea.
 */
const CONTACT_EMAIL = 'crux.competencias@gmail.com';

const STEPS = [
  {
    title: 'Publicas el enlace',
    body: 'Creas el evento con sus categorías y rondas, y compartes un enlace. La gente se inscribe sola, sin crear cuenta.',
  },
  {
    title: 'Los jueces puntúan desde el celular',
    body: 'Cada juez registra tops, zonas e intentos. Si el wifi se cae, la app sigue funcionando y el juez puede seguir puntuando. Lo que quedó pendiente se sincroniza solo cuando vuelve la señal.',
  },
  {
    title: 'La tabla se actualiza sola',
    body: 'El puntaje sale de los intentos, no se escribe a mano. Nadie suma en papel y nadie discute un puesto.',
  },
];

/** Una fila de la tabla real, con el mismo código de color que usa el evento. */
function SampleRow({
  rank,
  name,
  bib,
  cells,
  tops,
  attempts,
  leading,
}: {
  rank: number;
  name: string;
  bib: string;
  cells: ({ kind: 'top' | 'zone'; goes: number } | null)[];
  tops: number;
  attempts: number;
  leading?: boolean;
}) {
  return (
    <tr className={`border-b border-cardborder/60 ${leading ? 'bg-gold/10' : ''}`}>
      <td className={`px-4 py-4 text-center ${leading ? 'border-l-4 border-gold' : ''}`}>
        <span className="font-display text-3xl font-bold tabular-nums">{rank}</span>
      </td>
      {/* El nombre puede partirse y el dorsal desaparece en pantalla chica: esta
          sección existe para enseñar el código de colores, y si los badges
          quedan fuera del borde hay que descubrir que se desliza para ver el
          argumento. El enlace se comparte por WhatsApp; llega al teléfono. */}
      <td className="px-3 py-4 md:px-4">
        <span className="font-display text-base font-semibold md:text-xl">{name}</span>
        <span className="ml-2 hidden text-base text-muted tabular-nums md:inline">#{bib}</span>
      </td>
      {cells.map((cell, index) => (
        <td key={index} className="px-2 py-4 text-center">
          {cell === null ? (
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border-2 border-dashed border-cardborder px-2 font-display text-sm font-bold text-muted">
              ·
            </span>
          ) : (
            <span
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-display text-sm font-bold ${
                cell.kind === 'top' ? 'bg-gold text-ink' : 'bg-sage text-ink'
              }`}
            >
              {cell.goes}
            </span>
          )}
        </td>
      ))}
      <td className="px-3 py-4 text-center font-display text-2xl font-bold tabular-nums">{tops}</td>
      <td className="hidden px-3 py-4 text-center font-display text-lg tabular-nums text-muted sm:table-cell">
        {attempts}
      </td>
    </tr>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-28 px-6 py-16 md:px-10 md:py-24">
      <header className="flex flex-col gap-8">
        {/* Las mismas curvas de nivel que encabezan el panel, la tabla y el
            manual. La portada era la única pantalla sin ellas, y es la primera
            que ve alguien que llega de un enlace. */}
        <TopographicMotif />
        <span className="font-display text-lg font-bold tracking-[0.2em] text-pine">CRUX</span>

        <div className="flex flex-col gap-6">
          {/* Una frase por línea de ancho md para arriba, donde cabe: el
              titular son tres golpes y partir uno por la mitad los deshace. En
              teléfono los tramos vuelven a ser inline y envuelven donde puedan,
              que es lo correcto a 48px — mejor envolver que encoger la letra. */}
          <h1 className="max-w-[16ch] font-display text-5xl font-bold leading-[1.05] tracking-tight md:max-w-none md:text-7xl">
            {HEADLINE_LINES.map((line) => (
              <span key={line} className="md:block">
                {line}{' '}
              </span>
            ))}
          </h1>
          <p className="max-w-[62ch] text-lg leading-relaxed text-muted md:text-xl">
            <span className={brandWordClass}>CRUX</span> corre competencias de escalada de principio
            a fin: inscripción por enlace, jueces que puntúan desde el celular aunque se caiga el
            wifi, y una tabla pública que se actualiza sola.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link href={DEMO_BOARD} className={primaryButtonClass}>
            Ver una tabla en vivo
          </Link>
          <Link href="/sign-in" className={secondaryButtonClass}>
            Entrar como organizador
          </Link>
        </div>

        <StandingsMotif />
      </header>

      <section className="flex flex-col gap-7">
        <div className="flex flex-col gap-3">
          <span className={sectionEyebrowClass}>La pantalla del evento</span>
          <h2 className="max-w-[22ch] font-display text-3xl font-bold leading-tight md:text-4xl">
            La sala entera sabe quién va ganando, sin preguntarle a nadie.
          </h2>
          <p className="max-w-[62ch] text-lg leading-relaxed text-muted">
            Una pantalla fácil de leer desde lejos durante todo el evento, con colores pensados en
            el páramo y los desempates a la vista. La proyectas al empezar la ronda y no la vuelves
            a tocar: se actualiza sola cada vez que un juez registra un intento, así que nadie
            interrumpe a quien organiza para preguntar en qué puesto va.
          </p>
        </div>

        {/* min-w-0: un hijo de columna flex no baja de su contenido mínimo, y el
            nombre del competidor va en whitespace-nowrap. Sin esto la tabla
            estira la página entera y a 390 px se corta el titular. */}
        <div className="overflow-x-auto rounded-2xl border border-cardborder bg-card">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-cardborder px-4 py-3 text-sm text-muted">
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded bg-gold" aria-hidden /> Top
            </span>
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded bg-sage" aria-hidden /> Zona
            </span>
            <span>Los números son la cantidad de intentos.</span>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-cardborder">
                <th className={`${eyebrowClass} w-16 px-3 py-3 text-center md:w-24 md:px-4`}>Puesto</th>
                <th className={`${eyebrowClass} px-3 py-3 md:px-4`}>Competidor</th>
                <th className={`${eyebrowClass} px-2 py-3 text-center`}>B1</th>
                <th className={`${eyebrowClass} px-2 py-3 text-center`}>B2</th>
                <th className={`${eyebrowClass} px-2 py-3 text-center`}>B3</th>
                <th className={`${eyebrowClass} px-3 py-3 text-center`}>Tops</th>
                <th className={`${eyebrowClass} hidden px-3 py-3 text-center sm:table-cell`}>Intentos</th>
              </tr>
            </thead>
            <tbody>
              <SampleRow
                rank={1}
                name="Mariana Restrepo"
                bib="102"
                cells={[
                  { kind: 'top', goes: 1 },
                  { kind: 'top', goes: 2 },
                  { kind: 'top', goes: 2 },
                ]}
                tops={3}
                attempts={5}
                leading
              />
              <SampleRow
                rank={2}
                name="Emilia Zapata"
                bib="109"
                cells={[
                  { kind: 'top', goes: 4 },
                  { kind: 'top', goes: 3 },
                  { kind: 'top', goes: 2 },
                ]}
                tops={3}
                attempts={9}
              />
              <SampleRow
                rank={3}
                name="Salomé Arango"
                bib="106"
                cells={[
                  { kind: 'top', goes: 4 },
                  { kind: 'zone', goes: 3 },
                  { kind: 'top', goes: 1 },
                ]}
                tops={2}
                attempts={5}
              />
            </tbody>
          </table>
        </div>

        <Link
          href={DEMO_BOARD}
          className="font-display text-lg font-semibold text-pine underline decoration-gold decoration-2 underline-offset-4"
        >
          Ver la tabla completa de un evento, con sus gráficas
        </Link>
      </section>

      {/* Numerados porque sí son una secuencia: cada paso depende del anterior. */}
      <section className="flex flex-col gap-8">
        <h2 className="font-display text-3xl font-bold leading-tight md:text-4xl">Cómo funciona</h2>
        <ol className="grid gap-10 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-3 border-t-2 border-cardborder pt-5">
              <span className="font-display text-4xl font-bold tabular-nums text-gold-ink">
                {index + 1}
              </span>
              <h3 className="font-display text-xl font-semibold leading-snug">{step.title}</h3>
              <p className="leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className={sectionEyebrowClass}>Si organizas</span>
          <h3 className="font-display text-2xl font-bold leading-snug">
            Gimnasio, club o liga
          </h3>
          <p className="leading-relaxed text-muted">
            Defines categorías, rondas y el formato de puntaje que ya usas —tops y zonas, puntos
            IFSC, puntos por bloque, altura máxima— y el día del evento te dedicas al evento.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <span className={sectionEyebrowClass}>Si compites</span>
          <h3 className="font-display text-2xl font-bold leading-snug">No necesitas cuenta</h3>
          <p className="leading-relaxed text-muted">
            Te inscribes por el enlace que te pasa quien organiza, y ves los resultados desde el
            teléfono mientras la ronda corre. Tu historial se acumula entre eventos.
          </p>
        </div>
      </section>

      <footer className="flex flex-col gap-5 border-t-2 border-cardborder pt-10">
        <h2 className="max-w-[24ch] font-display text-3xl font-bold leading-tight md:text-4xl">
          ¿Vas a organizar una competencia?
        </h2>
        <p className="max-w-[52ch] text-lg leading-relaxed text-muted">
          Está hecho en Colombia y en español, para las competencias que ya se corren aquí.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/sign-up" className={primaryButtonClass}>
            Crear una cuenta de organizador
          </Link>
          <Link href={DEMO_BOARD} className={secondaryButtonClass}>
            Ver la demostración
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-display text-base font-semibold text-pine underline decoration-gold decoration-2 underline-offset-4"
          >
            Escríbenos
          </a>
        </div>
      </footer>
    </main>
  );
}
