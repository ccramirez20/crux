import { isMinor } from '@crux/core';

// Ley 1581 de 2012, art. 7: tratar datos de un menor está prohibido salvo
// autorización de su representante legal. Un atleta adulto no necesita nada
// aquí; uno menor sí, y un nombre en blanco o solo espacios no cuenta como
// autorización.
export function authorizationSatisfied(
  birthDate: string,
  authorizedBy: string | null | undefined,
  today: Date = new Date(),
): boolean {
  return !isMinor(birthDate, today) || Boolean(authorizedBy?.trim());
}
