/**
 * La cuenta de intentos que el juez lleva mientras alguien todavía está
 * probando un bloque.
 *
 * No es un intento capturado: es la rayita en la hoja. Por eso vive solo en el
 * celular del juez y no viaja a la base — mientras nadie logre nada no hay
 * ningún hecho que guardar, y en cuanto logra el top o la zona el número pasa a
 * la casilla y esto se borra.
 *
 * localStorage y no estado de React: el juez abre la ficha de Ana, la cierra,
 * mira a otros tres y vuelve. Entre medias el componente se desmonta, y en un
 * evento de dos horas la pestaña se recarga sola más de una vez.
 *
 * ponytail: por dispositivo. Dos jueces contando el mismo bloque llevan cuentas
 * separadas; si algún día se reparten un bloque entre varios, esto se mueve al
 * servidor. Hoy un bloque tiene un juez.
 */
const PREFIX = 'crux-tally:';

function key(problemId: string, registrationId: string): string {
  return `${PREFIX}${problemId}:${registrationId}`;
}

/**
 * Todo va en try/catch: esto corre en el celular de un juez a mitad de ronda y
 * un almacenamiento lleno o bloqueado no puede tumbar la captura. Sin contador
 * se sigue pudiendo puntuar a mano, que es como se hacía antes.
 */
export function readTally(problemId: string, registrationId: string): number {
  try {
    const raw = localStorage.getItem(key(problemId, registrationId));
    const value = raw === null ? 0 : Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeTally(problemId: string, registrationId: string, value: number): void {
  try {
    if (value <= 0) {
      localStorage.removeItem(key(problemId, registrationId));
      return;
    }
    localStorage.setItem(key(problemId, registrationId), String(value));
  } catch {
    // Sin memoria o en modo privado: el contador deja de recordar y el juez
    // escribe el número a mano. Nada más se rompe.
  }
}

export function clearTally(problemId: string, registrationId: string): void {
  writeTally(problemId, registrationId, 0);
}
