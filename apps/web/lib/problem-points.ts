/**
 * Un bloque de un evento `league_points` sin `topPoints` vale cero para todo el
 * mundo, y el scoring no tiene forma de quejarse: `scoreLeaguePoints` lee un
 * bloque ausente de la configuración como 0 puntos, que es lo correcto cuando
 * el bloque no existe y desastroso cuando existe pero nadie le puso precio. La
 * tabla sale con la sala entera en cero, empatada de primera, sin un solo error
 * en pantalla — y como los puntos no se pueden editar después, el arreglo el
 * día del evento es SQL a mano.
 *
 * El formulario ya marca el campo `required`, pero eso es del cliente y solo
 * sirve para fallar rápido. Este es el borde por donde entra el dato.
 *
 * Puro a propósito, por lo mismo que `attemptVerdict`: una regla que solo se
 * puede probar levantando una base de datos termina sin probarse.
 */
export function leagueBlockNeedsPoints(
  scoringFormat: string,
  topPoints: number | undefined,
): boolean {
  return scoringFormat === 'league_points' && topPoints === undefined;
}
