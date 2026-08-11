export const fieldClass =
  'rounded-lg border border-cardborder bg-card px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pine';

export const primaryButtonClass =
  'rounded-lg bg-gold px-6 py-3.5 font-display text-[15px] font-semibold text-ink transition hover:brightness-95 disabled:opacity-50';

export const secondaryButtonClass =
  'rounded-lg border-[1.5px] border-pine px-5 py-3 font-display text-sm font-semibold text-pine transition hover:bg-pine hover:text-white disabled:opacity-50';

export const cardClass = 'rounded-lg border border-cardborder bg-card p-5';

// Etiqueta real sobre cada campo. El placeholder no es etiqueta: desaparece
// justo cuando el usuario escribe y deja de existir para un lector de pantalla.
export const labelClass = 'text-sm font-medium text-bark';

// Rótulo de nivel — "CATEGORÍA", "RONDA", "BLOQUE". Es lo que hace legible la
// jerarquía sin dibujar más cajas.
export const eyebrowClass =
  'text-[11px] font-semibold uppercase tracking-[0.14em] text-muted';
