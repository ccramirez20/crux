/**
 * La firma de la portada: las curvas de nivel del páramo son las líneas de
 * posición del tablero. Arrancan juntas a la izquierda —al empezar la ronda
 * nadie ha escalado y todos van empatados— y se separan cruzándose hasta un
 * nodo, igual que la gráfica "puesto bloque a bloque" del producto.
 *
 * Los colores son los del podio de esa gráfica, ya validados como tripleta
 * contra la superficie de tarjeta.
 */
const LINES = [
  { d: 'M0,96 C180,96 240,92 320,74 T560,40 T780,30', endY: 30, color: '#E3A83B', width: 3 },
  { d: 'M0,102 C180,102 250,104 330,96 T580,72 T780,64', endY: 64, color: '#8FA3AE', width: 2.5 },
  { d: 'M0,108 C180,108 250,116 330,126 T580,104 T780,98', endY: 98, color: '#7E4F2C', width: 2.5 },
  { d: 'M0,114 C180,114 250,126 340,142 T590,150 T780,132', endY: 132, color: '#2F4A3E', width: 1.75 },
  { d: 'M0,120 C180,120 250,134 340,160 T590,178 T780,168', endY: 168, color: '#B9C4AC', width: 1.75 },
];

export function StandingsMotif() {
  return (
    <svg viewBox="0 0 800 200" className="block w-full" aria-hidden="true">
      {LINES.map((line, index) => (
        <g key={line.color}>
          <path
            d={line.d}
            fill="none"
            stroke={line.color}
            strokeWidth={line.width}
            strokeLinecap="round"
            className="crux-draw"
            style={{ animationDelay: `${index * 0.12}s` }}
          />
          {/* El nodo final, como el de la tabla: la línea termina en un puesto. */}
          <circle cx={780} cy={line.endY} r={line.width * 1.8} fill={line.color} />
        </g>
      ))}
    </svg>
  );
}
