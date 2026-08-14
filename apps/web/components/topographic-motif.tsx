/**
 * Las curvas de nivel que encabezan cada pantalla.
 *
 * `vectorEffect="non-scaling-stroke"` es lo que hace que se vean en un
 * celular: el viewBox mide 800 de ancho, así que en una pantalla de 390 px
 * todo se encoge a la mitad y un trazo de 1.5 terminaba dibujándose a menos de
 * un píxel — la marca quedaba en un hilo casi invisible justo en el aparato
 * desde el que la mayoría abre la app. Con esto el grosor se mide en píxeles
 * de pantalla y no en unidades del viewBox, así que es el mismo en el teléfono
 * y en el proyector.
 */
export function TopographicMotif() {
  return (
    <svg viewBox="0 0 800 90" className="block w-full" aria-hidden="true">
      <path
        d="M0,60 Q100,20 200,55 T400,50 T600,60 T800,45"
        fill="none"
        stroke="#B9C4AC"
        strokeWidth="2.25"
        vectorEffect="non-scaling-stroke"
        opacity="0.85"
      />
      <path
        d="M0,72 Q100,35 200,68 T400,64 T600,74 T800,58"
        fill="none"
        stroke="#2F4A3E"
        strokeWidth="2.25"
        vectorEffect="non-scaling-stroke"
        opacity="0.6"
      />
      <path
        d="M0,84 Q100,50 200,80 T400,78 T600,86 T800,72"
        fill="none"
        stroke="#E3A83B"
        strokeWidth="2.25"
        vectorEffect="non-scaling-stroke"
        opacity="0.75"
      />
    </svg>
  );
}
