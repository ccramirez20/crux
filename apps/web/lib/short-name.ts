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
