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
          <h2 className="font-display text-lg font-semibold text-pine">Qué datos se recogen</h2>
          <p className="mt-2 text-sm text-bark">
            Al inscribirte a una competencia: nombre completo, documento de identidad, fecha de
            nacimiento, género y la categoría en la que compites. Al crear una cuenta de
            organizador: tu nombre, correo, contraseña, y el nombre y ciudad de tu gimnasio o
            liga. Durante un evento, los jueces registran los intentos capturados en cada bloque.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Para qué se usan</h2>
          <p className="mt-2 text-sm text-bark">
            Únicamente para organizar competencias de escalada en CRUX: armar categorías y rondas,
            calcular resultados, mostrar la tabla pública de una competencia, y mantener el
            historial de un competidor entre eventos. No se usan para publicidad, no se venden y
            no se comparten con nadie fuera de CRUX y estas competencias.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Menores de edad</h2>
          <p className="mt-2 text-sm text-bark">
            Si el competidor es menor de edad, sus datos solo se tratan con la autorización de su
            padre, madre o acudiente, dada al inscribirlo y registrada junto a la inscripción.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Tus derechos</h2>
          <p className="mt-2 text-sm text-bark">
            Como titular de los datos puedes conocerlos, actualizarlos, corregirlos, pedir que se
            supriman, y revocar en cualquier momento la autorización dada. Para ejercer cualquiera
            de estos derechos, escribe a {CONTACTO_DATOS} indicando tu nombre y qué necesitas — se
            resuelve directamente, sin formulario aparte. Si consideras que tus datos no se están
            tratando bien, también puedes presentar una queja ante la Superintendencia de
            Industria y Comercio.
          </p>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-semibold text-pine">Vigencia</h2>
          <p className="mt-2 text-sm text-bark">
            Los datos se conservan mientras tengan una finalidad dentro de CRUX — por ejemplo, tu
            historial de competidor entre eventos — o hasta que ejerzas tu derecho a que se
            supriman.
          </p>
        </section>
      </div>
    </main>
  );
}
