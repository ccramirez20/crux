/**
 * Hasta cuándo acepta inscripciones un evento.
 *
 * La fecha límite es un día, no un instante, porque es lo que el organizador
 * escribe y lo que la gente entiende: "hasta el 30 de agosto" incluye el 30
 * entero. Y se mide en la zona del evento, no en la de quien se inscribe —
 * alguien inscribiéndose desde España a las 2 de la mañana no debe quedar fuera
 * de una fecha que en Bogotá todavía no ha terminado.
 */
export function isRegistrationOpen(
  deadline: string | null,
  timezone: string,
  now: Date = new Date(),
): boolean {
  // Sin fecha no hay cierre: el evento acepta inscripciones hasta que el
  // organizador ponga una. Es el comportamiento que ya tenían los eventos
  // creados antes de que esta columna existiera.
  if (!deadline) {
    return true;
  }
  return todayIn(timezone, now) <= deadline;
}

/**
 * El día de hoy (yyyy-mm-dd) en una zona horaria dada.
 *
 * 'en-CA' porque es el locale que formatea la fecha en ISO, que es justo la
 * forma en que la columna guarda el día — así la comparación es de texto y no
 * hay que construir un Date en otra zona, que es donde se cuelan los errores de
 * un día para arriba o para abajo.
 */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
