import { ImageResponse } from 'next/og';

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
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: STONE,
          color: INK,
          padding: 72,
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: 6, color: PINE }}>
          CRUX
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>
            Toda la sala mirando la misma tabla, al mismo tiempo.
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>
            Competencias de escalada, en español y en pesos.
          </div>
        </div>

        {/* Las mismas curvas de la portada: se separan y terminan en un puesto. */}
        <svg width={1056} height={120} viewBox="0 0 800 120">
          <path d="M0,72 C200,72 260,66 340,50 T600,26 T790,18" fill="none" stroke={GOLD} strokeWidth={5} />
          <path d="M0,80 C200,80 270,84 350,74 T610,58 T790,50" fill="none" stroke="#8FA3AE" strokeWidth={4} />
          <path d="M0,88 C200,88 270,98 350,106 T610,88 T790,82" fill="none" stroke="#7E4F2C" strokeWidth={4} />
          <path d="M0,96 C200,96 270,108 360,118 T620,112 T790,106" fill="none" stroke={PINE} strokeWidth={3} />
        </svg>
      </div>
    ),
    size,
  );
}
