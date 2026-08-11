'use client';

import { useState, type ReactNode } from 'react';

// Los tres formularios de esta pantalla — categoría, ronda, bloque — estaban
// siempre abiertos, así que la página era un muro de campos y la estructura del
// evento, que es lo que el organizador viene a leer, quedaba sepultada debajo.
// Ahora se leen primero y se crean después, a un toque.
//
// Tres usos concretos hoy, que es el mínimo para que esto exista como pieza
// compartida en vez de repetirse tres veces.
export function AddPanel({
  label,
  tone,
  children,
}: {
  label: string;
  tone: 'category' | 'round' | 'problem';
  children: (close: () => void) => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Cada nivel de la jerarquía tiene su color, el mismo que lo marca en el
  // desglose: así el formulario se ve como parte de donde va a caer lo creado.
  const accent = {
    category: 'border-pine text-pine hover:bg-pine',
    round: 'border-bark text-bark hover:bg-bark',
    problem: 'border-gold text-bark hover:bg-gold',
  }[tone];

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed bg-card/60 px-4 py-3 font-display text-sm font-semibold transition hover:text-white ${accent}`}
      >
        <span aria-hidden="true" className="text-base leading-none">
          +
        </span>
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-cardborder bg-card p-4 shadow-[0_1px_0_var(--color-cardborder)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold">{label}</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-sm font-medium text-pine underline"
        >
          Cancelar
        </button>
      </div>
      {children(() => setIsOpen(false))}
    </div>
  );
}
