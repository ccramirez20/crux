import Link from 'next/link';
import { TopographicMotif } from '@/components/topographic-motif';
import { cardClass } from '@/lib/ui';
import { CONTACTO_DATOS, RESPONSABLE_NOMBRE } from '@/lib/privacy';

export const metadata = {
  title: 'Política de tratamiento de datos · CRUX',
};

export default function PrivacidadPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-4 py-12">
      <div className="w-full max-w-2xl">
        <TopographicMotif />
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <Link href="/" className="font-display text-lg font-bold tracking-wide text-pine">
            CRUX
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold">
            Política de tratamiento de datos personales
          </h1>
          <p className="mt-1 text-sm text-muted">
            En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013.
          </p>
        </div>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Responsable</h2>
          <p className="mt-2 text-sm text-bark">
            {RESPONSABLE_NOMBRE}, operando la plataforma CRUX ({' '}
            <Link href="/" className="underline">
              cruxcompetencias.com
            </Link>
            ). Contacto: {CONTACTO_DATOS}.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Qué datos recopilamos</h2>
          <p className="mt-2 text-sm text-bark">
            Al inscribirte a una competencia, recogemos tu nombre completo, documento de
            identidad, fecha de nacimiento, género y categoría. Si creas una cuenta de
            organizador, pedimos tu nombre, correo, contraseña y el nombre y ciudad de tu
            gimnasio o liga. Durante el evento, los jueces registran los intentos de cada bloque.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Para qué se usan</h2>
          <p className="mt-2 text-sm text-bark">
            Únicamente para organizar competencias de escalada en CRUX: crear categorías y rondas,
            calcular resultados, mostrar la tabla pública de cada competencia y mantener el
            historial de los competidores entre eventos. No usamos tus datos para publicidad, no
            los vendemos ni los compartimos con nadie fuera de CRUX y las competencias.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Menores de edad</h2>
          <p className="mt-2 text-sm text-bark">
            Si el competidor es menor de edad, sus datos solo se usan con la autorización de su
            padre, madre o acudiente, quien la da al momento de inscribirlo.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Tus derechos</h2>
          <p className="mt-2 text-sm text-bark">
            Puedes conocer, actualizar y corregir tus datos, pedir que los eliminemos o revocar en
            cualquier momento la autorización que nos diste. Para ejercer cualquiera de estos
            derechos, escribe a {CONTACTO_DATOS} con tu nombre y cuéntanos qué necesitas. Lo
            resolvemos directamente, sin formularios adicionales. Si consideras que tus datos no
            se están tratando adecuadamente, también puedes presentar una queja ante la
            Superintendencia de Industria y Comercio.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Vigencia</h2>
          <p className="mt-2 text-sm text-bark">
            Los datos se conservan mientras tengan una finalidad dentro de CRUX —por ejemplo,
            mantener tu historial como competidor entre eventos— o hasta que solicites que se
            eliminen.
          </p>
        </section>
      </div>
    </main>
  );
}
