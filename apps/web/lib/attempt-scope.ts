/** Lo que la base sabe del bloque: a qué categoría pertenece y qué código exige su evento. */
export interface ProblemScope {
  categoryId: string;
  /** `null` cuando el evento no puso código: entonces no hay nada que exigir. */
  judgeCode: string | null;
}

export type AttemptVerdict = 'ok' | 'bad-code' | 'out-of-scope';

/**
 * La pantalla del juez no tiene login — el QR es público y cualquiera en el
 * gimnasio lo escanea — así que este es el único lugar donde el código del
 * evento se exige de verdad. El cliente también lo revisa, pero solo para
 * fallar rápido; una revisión en el cliente no protege a nadie.
 *
 * Y un bloque pertenece a una ronda, que pertenece a una categoría: la
 * inscripción del atleta tiene que estar en esa misma categoría, no apenas en
 * el mismo evento. Una fila cruzada entre categorías no la puede rankear
 * ninguna estrategia de puntaje y nada más abajo la atraparía.
 *
 * Puro a propósito: es la frontera de confianza de la captura, y una frontera
 * que solo se puede probar levantando una base de datos termina sin probarse.
 */
export function attemptVerdict(
  problem: ProblemScope | undefined,
  registration: { categoryId: string } | undefined,
  givenCode: string | null,
): AttemptVerdict {
  // Un bloque que no existe no permite ni siquiera revisar el código.
  if (!problem) {
    return 'out-of-scope';
  }

  // El código va antes que la categoría, y el orden importa: un código
  // equivocado es lo que el juez puede corregir ahí mismo. Decirle "categoría
  // incorrecta" cuando lo que pasó es que se metió al evento vecino lo manda a
  // buscar el problema donde no está.
  if (problem.judgeCode !== null) {
    const given = givenCode?.trim().toUpperCase() ?? null;
    if (given === null || given !== problem.judgeCode.toUpperCase()) {
      return 'bad-code';
    }
  }

  if (!registration || registration.categoryId !== problem.categoryId) {
    return 'out-of-scope';
  }

  return 'ok';
}
