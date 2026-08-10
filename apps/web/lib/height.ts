// El teclado del teléfono en es-CO trae coma decimal, no punto, y un
// <input type="number"> descarta la coma en silencio: "18,5" llegaba como 185,
// treinta y tres veces la altura real y sin nada en pantalla que lo delatara.
// El campo pasa a ser texto y la coma se acepta como lo que es aquí, un
// separador decimal.
export function parseHeight(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  // Sin exponentes ni signos: una altura es un decimal simple, y `Number()`
  // por sí solo aceptaría "1e3" y "0x10" como válidos.
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
