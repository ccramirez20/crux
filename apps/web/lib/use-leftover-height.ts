import { useEffect, useState } from 'react';

/**
 * Cuánto le sobra a un contenedor `flex-1` después de lo que dibuja de
 * verdad — pensado para decidir si vale la pena rellenar ese hueco con algo
 * decorativo (las curvas de marca) en vez de dejarlo vacío.
 *
 * `box`/`content` son estado, no `useRef`: el panel que mide vive detrás de
 * un turno que rota (el contenedor no existe en el DOM hasta que ese turno
 * está activo). Con `useRef` el `useEffect` solo corre una vez, en el primer
 * render — si el turno todavía no estaba montado ahí, `box.current` era
 * `null`, el `ResizeObserver` nunca se conectaba a nada, y `leftover` se
 * quedaba clavado en 0 para siempre por más que sobrara espacio real. Con
 * estado, que el `ref` pase de `null` a un elemento dispara un render y el
 * efecto vuelve a correr con el nodo de verdad.
 *
 * `scrollHeight` no sirve para medir el contenido — con `overflow-hidden` y
 * contenido que cabe holgado, `scrollHeight` iguala a `clientHeight` (nunca
 * menor), así que la resta siempre daría cero. `content.offsetHeight` sí es
 * el tamaño real del contenido, sin que la caja que lo envuelve lo infle.
 */
export function useLeftoverHeight() {
  const [box, setBox] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const [leftover, setLeftover] = useState(0);

  useEffect(() => {
    if (!box || !content) {
      return;
    }
    const measure = () => setLeftover(box.clientHeight - content.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [box, content]);

  return { boxRef: setBox, contentRef: setContent, leftover };
}

/** Lo que ocupa cada pieza de relleno, medido contra lo que ocupa de verdad en pantalla. */
export const FILL = { capturesHeader: 34, capture: 44, podium: 250, motif: 76 };
