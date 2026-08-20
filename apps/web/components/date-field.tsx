'use client';

import { useEffect, useRef, useState } from 'react';
import { buildMonthGrid, parseIsoDate } from '@/lib/calendar-grid';
import { fieldClass } from '@/lib/ui';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function yearsPageStart(year: number): number {
  return year - (((year % 12) + 12) % 12);
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Un `<input type="date">` normal por debajo — así se conserva la escritura
 * a mano con los segmentos día/mes/año del navegador — más un calendario
 * propio en vez del que abre el navegador. El problema que resuelve es
 * puntual: en el calendario nativo, pasar de la vista de mes/año a la de
 * días no es obvio. Aquí las mismas flechas de siempre hacen ese viaje en un
 * clic, sin salir del componente.
 */
export function DateField({
  id,
  value,
  onChange,
  required,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const [viewYear, setViewYear] = useState(() => parseIsoDate(value)?.year ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseIsoDate(value)?.month ?? new Date().getMonth());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleOutsideClick(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  function openCalendar() {
    const parsed = parseIsoDate(value);
    setViewYear(parsed?.year ?? new Date().getFullYear());
    setViewMonth(parsed?.month ?? new Date().getMonth());
    setViewMode('days');
    setIsOpen(true);
  }

  function pickDay(iso: string) {
    onChange(iso);
    setIsOpen(false);
  }

  function shiftMonth(delta: number) {
    let month = viewMonth + delta;
    let year = viewYear;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    setViewMonth(month);
    setViewYear(year);
  }

  const today = todayIso();

  return (
    <div ref={wrapperRef} className="relative w-fit">
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className={`${className ?? fieldClass} pr-7 [&::-webkit-calendar-picker-indicator]:hidden`}
      />
      {/* Firefox y Safari dibujan su propio ícono de calendario dentro del
          input y no tienen el pseudo-elemento `::-webkit-...` que lo esconde
          en Chrome — sin esto, ahí se veían dos calendarios superpuestos. Este
          bloque tapa esa esquina con el mismo fondo del campo y encima va el
          botón propio, así que no importa qué dibuje el navegador debajo. */}
      <div className="absolute inset-y-px right-px flex w-6 items-center justify-center rounded-r-lg bg-card">
        <button
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : openCalendar())}
          aria-label="Abrir calendario"
          aria-expanded={isOpen}
          className="text-muted hover:text-pine"
        >
          📅
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-72 rounded-lg border border-cardborder bg-card p-3 shadow-lg">
          {viewMode === 'days' ? (
            <>
              <div className="flex items-center justify-between pb-2">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Mes anterior"
                  className="rounded px-2 py-1 text-ink hover:bg-stone"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('months')}
                  className="font-display text-sm font-semibold text-ink hover:text-pine"
                >
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Mes siguiente"
                  className="rounded px-2 py-1 text-ink hover:bg-stone"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted">
                {WEEKDAY_LABELS.map((label, index) => (
                  <span key={index}>{label}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {buildMonthGrid(viewYear, viewMonth).map((cell, index) =>
                  cell === null ? (
                    <span key={index} />
                  ) : (
                    <button
                      key={cell.iso}
                      type="button"
                      onClick={() => pickDay(cell.iso)}
                      className={`rounded-lg py-1.5 text-sm transition ${
                        cell.iso === value
                          ? 'bg-pine text-white'
                          : cell.iso === today
                            ? 'border border-pine text-pine'
                            : 'text-ink hover:bg-stone'
                      }`}
                    >
                      {cell.day}
                    </button>
                  ),
                )}
              </div>
            </>
          ) : viewMode === 'months' ? (
            <>
              <div className="flex items-center justify-between pb-2">
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y - 1)}
                  aria-label="Año anterior"
                  className="rounded px-2 py-1 text-ink hover:bg-stone"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('years')}
                  className="font-display text-sm font-semibold text-ink hover:text-pine"
                >
                  {viewYear}
                </button>
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y + 1)}
                  aria-label="Año siguiente"
                  className="rounded px-2 py-1 text-ink hover:bg-stone"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_NAMES.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setViewMonth(index);
                      setViewMode('days');
                    }}
                    className={`rounded-lg py-2 text-sm transition ${
                      index === viewMonth ? 'bg-pine text-white' : 'text-ink hover:bg-stone'
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Página de 12 años, centrada en la que se estaba viendo — es lo
                  que hacía falta para no tener que darle a "año anterior" una
                  por una hasta llegar, por ejemplo, a una fecha de nacimiento. */}
              <div className="flex items-center justify-between pb-2">
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y - 12)}
                  aria-label="12 años atrás"
                  className="rounded px-2 py-1 text-ink hover:bg-stone"
                >
                  ‹
                </button>
                <span className="font-display text-sm font-semibold text-ink">
                  {yearsPageStart(viewYear)}–{yearsPageStart(viewYear) + 11}
                </span>
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y + 12)}
                  aria-label="12 años adelante"
                  className="rounded px-2 py-1 text-ink hover:bg-stone"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => yearsPageStart(viewYear) + i).map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setViewYear(year);
                      setViewMode('months');
                    }}
                    className={`rounded-lg py-2 text-sm transition ${
                      year === viewYear ? 'bg-pine text-white' : 'text-ink hover:bg-stone'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
