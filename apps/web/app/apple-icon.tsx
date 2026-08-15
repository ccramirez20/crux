import { ImageResponse } from 'next/og';

/**
 * El ícono que ve un iPhone.
 *
 * `app/icon.svg` ya existía y en Chrome de escritorio se ve bien, pero Safari
 * —y con él la vista de pestañas de un iPhone, que es donde más gente va a ver
 * esto el día del evento— no acepta SVG como favicon: se rinde y dibuja la
 * inicial del dominio sobre un cuadro gris. De ahí la "C" suelta.
 *
 * Lo que Safari sí lee es `apple-touch-icon`, y tiene que ser PNG. Se genera
 * aquí en el build con `next/og` en vez de guardar un binario: el motivo es el
 * mismo del `icon.svg` y del resto de la marca, así que vive una sola vez en
 * código y no hay dos archivos que se puedan desincronizar.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const STONE = '#EFEBDD';
const PINE = '#2F4A3E';
const GOLD = '#E3A83B';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: STONE,
        }}
      >
        {/* Sin esquinas redondeadas: iOS recorta el ícono con su propia
            máscara, y redondearlo aquí deja un borde de fondo por dentro. */}
        {/* Dos trazos y no las cuatro curvas del motivo: a 60 px en la vista de
            pestañas, cuatro líneas finas se funden en una mancha. El
            adelantamiento —la dorada arranca abajo y termina arriba— es lo que
            queda legible, y es lo que la marca dice. */}
        <svg width={180} height={180} viewBox="0 0 32 32">
          <path
            d="M4 22 C12 22 15 17 28 7"
            fill="none"
            stroke={GOLD}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <path
            d="M4 10 C12 10 15 16 28 25"
            fill="none"
            stroke={PINE}
            strokeWidth={3.4}
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
