'use client';

import { useState } from 'react';

export interface ConversionSegment {
  label: string;
  count: number;
  fill: string;
  swatch: string;
}

/**
 * Cómo terminó cada bloque intentado, en una barra. Es la lectura que ningún
 * evento suelto puede dar: qué tan seguido convierte.
 *
 * Colores: oro para el top y verde para la zona son los mismos de la tabla
 * pública, para que las dos pantallas hablen el mismo idioma. El verde es pine
 * y no el sage de las insignias porque aquí los rellenos se tocan: sage contra
 * oro se cae a ΔE 12.4 en visión normal, bajo el piso de 15. Pine contra oro da
 * 41.1 (36.1 en protanopía). Validado con validate_palette.js, no elegido a ojo.
 *
 * Cliente y no servidor solo por el hover: al señalar un tramo se apagan los
 * otros y su renglón de leyenda se resalta, que es lo que conecta el color con
 * su significado sin obligar a comparar dos manchas del mismo verde. La
 * información completa ya está escrita en la leyenda, así que quien no puede
 * pasar el mouse —teclado, lector de pantalla, teléfono— no se pierde nada: el
 * hover subraya, no revela.
 */
export function ConversionBar({ segments }: { segments: ConversionSegment[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return null;
  }
  const shown = segments.filter((s) => s.count > 0);
  const dimmed = (label: string) => active !== null && active !== label;

  return (
    <div className="flex flex-col gap-3" onMouseLeave={() => setActive(null)}>
      {/* 2 px de hueso entre tramos: el corte hace legible el límite sin
          depender solo del color. */}
      <div className="flex h-5 gap-[2px] overflow-hidden rounded" role="presentation">
        {shown.map((segment) => (
          <div
            key={segment.label}
            onMouseEnter={() => setActive(segment.label)}
            className={`${segment.fill} transition-opacity duration-150 ${
              dimmed(segment.label) ? 'opacity-30' : 'opacity-100'
            }`}
            style={{ width: `${(segment.count / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {shown.map((segment) => (
          <li
            key={segment.label}
            onMouseEnter={() => setActive(segment.label)}
            className={`flex items-center gap-2 text-sm transition-opacity duration-150 ${
              dimmed(segment.label) ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <span className={`h-3 w-3 shrink-0 rounded-sm ${segment.swatch}`} aria-hidden />
            <span className="font-display font-semibold tabular-nums">{segment.count}</span>
            <span className={active === segment.label ? 'text-ink' : 'text-muted'}>
              {segment.label} · {Math.round((segment.count / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
