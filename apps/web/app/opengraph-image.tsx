import { ImageResponse } from 'next/og';
import { HEADLINE_LINES } from '@/lib/labels';

// Sin fuente propia a propósito: cargarla obligaría a bajar el archivo en cada
// build. Lo que hace reconocible la tarjeta es la paleta y las curvas, no la
// tipografía.
export const alt = 'Crux — Competencias de escalada';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const STONE = '#EFEBDD';
const INK = '#241F19';
const PINE = '#2F4A3E';
const GOLD = '#E3A83B';
const MUTED = '#7A7266';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      // Alturas explícitas y no space-between: Satori reparte el sobrante
      // apretando los bloques, y el logotipo terminaba encima del titular.
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
          background: STONE,
          color: INK,
          padding: 68,
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, letterSpacing: 6, color: PINE }}>
          CRUX
        </div>

        {/* Una frase por línea, igual que en la portada: aquí siempre cabe. */}
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 58, fontWeight: 700, lineHeight: 1.1 }}>
          {HEADLINE_LINES.map((line) => (
            <div key={line} style={{ display: 'flex' }}>
              {line}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontSize: 28, color: MUTED }}>
          Competencias de escalada, en español y en pesos.
        </div>

        {/* Las mismas curvas de la portada, con el mismo adelantamiento: la
            dorada sale cuarta y termina primera. */}
        <svg width={1064} height={170} viewBox="0 0 800 128">
          <path d="M0,76 C260,76 300,62 420,40 S640,14 780,10" fill="none" stroke={GOLD} strokeWidth={6} strokeLinecap="round" />
          <path d="M0,66 C260,66 320,58 440,46 S660,34 780,32" fill="none" stroke="#8FA3AE" strokeWidth={4.5} strokeLinecap="round" />
          <path d="M0,70 C260,70 320,78 440,72 S660,62 780,60" fill="none" stroke="#7E4F2C" strokeWidth={4.5} strokeLinecap="round" />
          <path d="M0,62 C260,62 300,74 420,86 S640,98 780,100" fill="none" stroke={PINE} strokeWidth={3.5} strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
