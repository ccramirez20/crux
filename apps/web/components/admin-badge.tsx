import { brandWordClass } from '@/lib/ui';

/**
 * El distintivo de la cuenta que administra la plataforma. No sirve para nada
 * funcional: existe para que quien entra sepa de un vistazo que está en la
 * cuenta de administración y no en la de un gimnasio, que es justo el error que
 * se comete cuando las dos se ven idénticas.
 *
 * Pixel art y no un icono: el resto del producto es curva de nivel y tipografía
 * seria, así que una sola pieza de trama gruesa se lee como "esto es tuyo" sin
 * competir con nada. Un desplome con presas doradas, alguien a media vía, y el
 * sol del páramo saliendo por detrás.
 *
 * El lienzo es la rejilla: 36 × 26 celdas, una letra por color. Editarlo es
 * editar estas líneas, no calcular coordenadas. `crispEdges` apaga el
 * suavizado, que es lo único que separa el pixel art de un dibujo borroso.
 *
 * La primera versión era un pico lejano con la figura en la cumbre y no se leía:
 * a este tamaño una persona de cinco píxeles es una mancha. Lo que la hace
 * reconocible no es más detalle, es ocupar más del cuadro.
 */
const PIXELS = [
  '............pppppppppppppppppppppppp',
  '....ooo.....pppppppppppppppppppppppp',
  '...ooooo....ppppppppppppoppppppppppp',
  '..ooooooo...pppppppppppppppppppppppp',
  '..ooooooo....ppppppppppppppppppppppp',
  '..ooooooo....ppppppppppppooppppppppp',
  '...ooooo.....ppppppppppppccppppppppp',
  '....ooo.......pppppppppppccppppppppp',
  '..............pppppppcccpccppppppopp',
  '..............pppppppcccpccppppppppp',
  '...............pppocccccccpppppppppp',
  '...............ppppppccccppppppppppp',
  '...............ppppppccccppppppppppp',
  '................pppppcccccpppppppppp',
  '................pppppccpcccppppppppp',
  '................pppppccppcccpppppppp',
  '.................pppccpppppccppppppp',
  '.................pppccppppppccpppppp',
  '.................pppoppppppppopppppp',
  '..................pppppppppppppppppp',
  '....llll..........pppppppppppppppppp',
  '.....ll...........ppppppppppppppoppp',
  '.....ll............ppppppppppppppppp',
  'rrrrrrrrrrrrrrrrrrrpppoppppppppppppp',
  'rrrrrrrrrrrrrrrrrrrppppppppppppppppp',
  'rrrrrrrrrrrrrrrrrrrppppppppppppppppp',
];

const PALETTE: Record<string, string> = {
  p: '#2f4a3e', // el muro desplomado — pine
  c: '#fbf8f0', // quien escala — card, para que resalte contra la roca
  o: '#e3a83b', // el sol y las presas — gold
  r: '#6b4a34', // el suelo del páramo — bark
  l: '#b9c4ac', // un frailejón — sage
};

export function AdminBadge() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-cardborder bg-card p-4">
      <svg
        viewBox="0 0 36 26"
        shapeRendering="crispEdges"
        role="img"
        aria-label="Alguien escalando un desplome al amanecer"
        className="h-auto w-28 shrink-0 rounded"
      >
        <rect width="36" height="26" fill="#efebdd" />
        {PIXELS.flatMap((row, y) =>
          [...row].map((cell, x) =>
            PALETTE[cell] ? (
              <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PALETTE[cell]} />
            ) : null,
          ),
        )}
      </svg>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={`${brandWordClass} text-sm uppercase`}>Administrador</span>
        <p className="text-sm text-muted">
          Estás en la cuenta que lleva la plataforma. Aquí se reparten las invitaciones y viven las
          organizaciones de prueba.
        </p>
      </div>
    </div>
  );
}
