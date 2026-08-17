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
 *
 * Segunda pasada, después de revisión con CR: la roca es gris — el pine
 * quedaba como bosque, no piedra — y sus presas en un gris más claro, no
 * doradas, para que no compitan con el sol. El escalador tiene casco negro,
 * camiseta pine, pantalón bark y zapatos en el dorado de Crux; un brazo sube
 * a una presa y el otro queda cerca del cuerpo, una pierna alta y la otra
 * estirada a un apoyo más lejano — no los dos brazos simétricos de antes.
 */
const PIXELS = [
  '............pppppppppppppppppppppppp',
  '....ooo.....pppppppppppppppppppppppp',
  '...ooooo....ppppppppppppppppppwppppp',
  '..ooooooo...ppppppppppppppcwpppppppp',
  '..ooooooo....pppppppppkkpspppppppppp',
  '..ooooooo....ppppppppssssppppppppppp',
  '...ooooo.....ppppppcsssspppppppppppp',
  '....ooo.......pppppppssspppppppppppp',
  '..............pppppprrrrrpppppppwppp',
  '..............ppppprpppprrpppppppppp',
  '...............ppprpppppppowpppppppp',
  '...............pwopppppppppppppppppp',
  '...............ppppppppppppppppppppp',
  '................ppppppppppppppwppppp',
  '................pppppppppppppppppppp',
  '..................pppppppppppppppppp',
  '...l.l...........ppppppppppppppppppp',
  '..lllll..........ppppppppppppppppppp',
  '..lllll....ll....ppppppppwpppppppppp',
  '...lll....llll....pppppppppppppppppp',
  '....l......ll.....pppppppppppppppppp',
  '....l.......l.....pppppppppppppppwpp',
  '....l.......l......ppppppppppppppppp',
  'rrrrrrrrrrrrrrrrrrrppppppppppppppppp',
  'rrrrrrrrrrrrrrrrrrrppppppppppppppppp',
  'rrrrrrrrrrrrrrrrrrrppppppppppppppppp',
];

const PALETTE: Record<string, string> = {
  p: '#a39a8c', // la roca — piedra gris del páramo
  s: '#2f4a3e', // camiseta — pine
  r: '#6b4a34', // pantalón, y el suelo del páramo — bark
  c: '#fbf8f0', // manos — crema, para que resalten contra la roca
  o: '#e3a83b', // el sol y los zapatos — gold
  l: '#b9c4ac', // los frailejones — sage
  w: '#c7c0b4', // presas — un gris más claro que la roca
  k: '#241f19', // el casco — ink
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
