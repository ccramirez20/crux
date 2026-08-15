import { ImageResponse } from 'next/og';

/**
 * El favicon, en PNG y no en SVG.
 *
 * Esto era `icon.svg`. Se ve bien en Chrome de escritorio y **no se ve en un
 * iPhone**: los navegadores de iOS son todos WebKit por debajo, y WebKit no
 * dibuja un favicon SVG — se rinde y pinta la inicial del dominio sobre un
 * cuadro gris. De ahí la "C" suelta que no era de ninguna cuenta. Se comprobó
 * contra producción, que solo servía el SVG.
 *
 * El PNG lo entiende todo el mundo, así que el ícono deja de depender del
 * navegador. Se genera en el build desde el mismo motivo del `apple-icon`, no
 * se guarda como binario: son dos tamaños de la misma marca y de esta forma no
 * pueden quedar diciendo cosas distintas.
 */
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

const STONE = '#EFEBDD';
const PINE = '#2F4A3E';
const GOLD = '#E3A83B';

export default function Icon() {
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
          borderRadius: 14,
        }}
      >
        {/* Dos trazos gruesos y no las cuatro curvas finas del motivo: a 16 px
            —que es como se ve en una pestaña— cuatro líneas se funden en una
            mancha. Lo que sobrevive al tamaño es el adelantamiento. */}
        <svg width={64} height={64} viewBox="0 0 32 32">
          <path
            d="M5 22 C12 22 15 17 27 8"
            fill="none"
            stroke={GOLD}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
          <path
            d="M5 11 C12 11 15 16 27 24"
            fill="none"
            stroke={PINE}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
