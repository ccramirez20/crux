/**
 * La firma de la portada: las curvas de nivel del páramo son las líneas de
 * posición del tablero. Arrancan apretadas a la izquierda —al empezar la ronda
 * nadie ha escalado y todos van empatados— y se **cruzan**: la dorada sale
 * cuarta y termina primera. Sin cruce serían un abanico decorativo; el cruce es
 * la historia de una tabla, y es la misma forma de la gráfica "puesto bloque a
 * bloque" del producto.
 *
 * Los colores son los del podio de esa gráfica, ya validados como tripleta
 * contra la superficie de tarjeta.
 */
const LINES = [
  // Sale cuarta y adelanta a tres: es la única línea que hay que seguir.
  { d: 'M0,110 C260,110 300,96 420,70 S640,34 770,28', endY: 28, rank: 1, color: '#E3A83B', width: 3.5 },
  { d: 'M0,100 C260,100 320,92 440,78 S660,66 770,62', endY: 62, rank: 2, color: '#8FA3AE', width: 2.5 },
  { d: 'M0,104 C260,104 320,112 440,106 S660,98 770,96', endY: 96, rank: 3, color: '#7E4F2C', width: 2.5 },
  // Arrancaba primera y se deja pasar.
  { d: 'M0,96 C260,96 300,106 420,116 S640,128 770,130', endY: 130, rank: 4, color: '#2F4A3E', width: 2 },
  { d: 'M0,114 C260,114 330,128 450,146 S670,162 770,164', endY: 164, rank: 5, color: '#B9C4AC', width: 2 },
];

export function StandingsMotif() {
  return (
    <svg viewBox="0 0 800 190" className="block w-full" aria-hidden="true">
      {/* El desfase entre líneas va a la par de la duración del trazo: con 0.1s
          contra 3s las cinco salen casi encimadas y se pierde el arranque
          escalonado. Los dos trazos de una misma línea comparten delay o el
          contra-trazo se despega del color. */}
      {LINES.map((line, index) => (
        <g key={line.color}>
          {/* Contra-trazo del color del fondo: en un cruce una línea tiene que
              pasar visiblemente por encima de la otra, o se disuelven en una X.
              Es el mismo recurso que usa la gráfica real. */}
          <path
            d={line.d}
            fill="none"
            stroke="#EFEBDD"
            strokeWidth={line.width + 6}
            strokeLinecap="round"
            className="crux-draw"
            style={{ animationDelay: `${index * 0.2}s` }}
          />
          <path
            d={line.d}
            fill="none"
            stroke={line.color}
            strokeWidth={line.width}
            strokeLinecap="round"
            className="crux-draw"
            style={{ animationDelay: `${index * 0.2}s` }}
          />
          <circle cx={770} cy={line.endY} r={line.width * 1.7} fill={line.color} />
          {/* El puesto al final, como en la tabla: esto es un tablero, no un
              adorno. */}
          <text
            x={790}
            y={line.endY + 6}
            fontSize={17}
            fontWeight={700}
            fill={line.rank <= 3 ? '#241F19' : '#7A7266'}
            className="tabular-nums"
          >
            {line.rank}
          </text>
        </g>
      ))}
    </svg>
  );
}
