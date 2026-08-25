/**
 * Primer nombre completo + inicial de hasta los dos tokens siguientes.
 * "Laura Sarabria" → "Laura S.", "María Fernanda Restrepo Villalobos" →
 * "María F. R." — nunca crece más allá de tres palabras sin importar cuántos
 * tokens traiga el nombre, así que "no cabe" no es un blanco móvil.
 */
export function shortName(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return fullName;
  }
  const [first, ...rest] = tokens;
  return [first, ...rest.slice(0, 2).map((token) => `${token[0]!.toUpperCase()}.`)].join(' ');
}

/**
 * Nombre completo, salvo el último apellido cuando hay cuatro tokens o más:
 * ahí se deja solo la inicial. "María Fernanda Restrepo Villalobos" →
 * "María Fernanda Restrepo V." — a diferencia de `shortName`, conserva casi
 * todo el nombre; solo recorta el segundo apellido, que es lo que sobra
 * cuando ya hay espacio para mostrar el nombre completo pero el más largo de
 * la lista igual se comprime demasiado contra `textLength`.
 */
export function fitName(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 4) {
    return fullName;
  }
  const last = tokens.at(-1)!;
  return [...tokens.slice(0, -1), `${last[0]!.toUpperCase()}.`].join(' ');
}
