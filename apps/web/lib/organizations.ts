/**
 * Cuál de las organizaciones de la cuenta está viendo el panel.
 *
 * Casi todas las cuentas tienen exactamente una —nace con la cuenta y no hay
 * dónde pedir otra—, así que esto solo tiene trabajo real en la cuenta de
 * administración, que lleva la organización de producción y la de pruebas.
 *
 * Falla hacia la primera: una cookie vacía, caducada o que nombra una
 * organización ajena no puede dejar el panel sin nada que mostrar. La cookie no
 * es un permiso —la consulta de eventos sigue filtrando por `ownerId`—, es la
 * memoria de en cuál te quedaste.
 */
export function resolveSelectedOrganization<T extends { id: string }>(
  owned: readonly T[],
  cookieValue: string | undefined,
): T | undefined {
  return owned.find((organization) => organization.id === cookieValue) ?? owned[0];
}

export const ORGANIZATION_COOKIE = 'crux_org';
