/**
 * El único administrador de la plataforma, por correo.
 *
 * No hay concepto de rol en el esquema y montar uno para un solo administrador
 * sería la abstracción sin tres usos que CLAUDE.md pide evitar. Falla cerrado:
 * si `ADMIN_EMAIL` no está puesta, nadie es administrador —al revés, un
 * `undefined === undefined` volvería administrador a cualquiera sin correo.
 */
export function isAdmin(email: string | null | undefined): boolean {
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(admin) && email?.trim().toLowerCase() === admin;
}
