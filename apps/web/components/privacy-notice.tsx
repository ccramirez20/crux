import Link from 'next/link';
import { CONTACTO_DATOS, RESPONSABLE_NOMBRE } from '@/lib/privacy';

const COPY = {
  // Inscripción pública: datos del competidor, capturados por quien organiza.
  inscripcion:
    'para organizar esta competencia y las siguientes en las que compitas: armar categorías, calcular resultados y guardar tu historial entre eventos',
  // Cuenta de organizador: sus propios datos, para usar el panel.
  organizador:
    'para darte acceso al panel y mostrar el nombre de tu organización en tus eventos',
} as const;

/**
 * El aviso corto que exige el art. 14 del Decreto 1377 de 2013: quién es el
 * responsable, para qué se usan los datos, y dónde está la política completa.
 * No repite la política entera aquí — para eso remite a /privacidad.
 */
export function PrivacyNotice({ variant }: { variant: keyof typeof COPY }) {
  return (
    <p className="text-xs text-muted">
      Estos datos los trata <span className="font-medium text-bark">{RESPONSABLE_NOMBRE}</span>,
      responsable de CRUX, únicamente {COPY[variant]}. No se usan para publicidad ni se comparten
      con nadie fuera de CRUX y estas competencias de escalada. Puedes conocer, corregir o pedir
      que se borren tus datos escribiendo a {CONTACTO_DATOS}. Política completa:{' '}
      <Link href="/privacidad" className="underline hover:text-bark">
        cruxcompetencias.com/privacidad
      </Link>
      .
    </p>
  );
}
