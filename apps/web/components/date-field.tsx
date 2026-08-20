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

// El día se acepta 1-31 sin mirar cuántos tiene el mes en curso (así que
// "31 de febrero" pasa el tecleo) — el calendario, que sí sabe la grilla
// real, es de donde sale una fecha siempre válida sin tener que escribir.
// ponytail: si algún día hace falta validar el mes+día juntos al escribir,
// ese es el sitio.
function clampSegment(digits: string, max: number): string {
  if (digits.length < 2) {
    return digits;
  }
  const n = Math.min(Math.max(Number(digits), 1), max);
  return String(n).padStart(2, '0');
}

/**
 * Reemplaza por completo el `<input type="date">` nativo — no solo el
 * calendario, también los segmentos día/mes/año, que ya no se pueden
 * esconder de fondo. Chrome dejó de respetar `display:none` sobre
 * `::-webkit-calendar-picker-indicator` (confirmado con `getComputedStyle`
 * contra el elemento real: reporta `inline-block` sin importar el CSS), así
 * que el ícono nativo se veía siempre, junto al propio — de ahí "dos
 * calendarios". Con tres campos de texto en vez del input nativo, no hay
 * pseudo-elemento del navegador que aparezca: el único ícono es el nuestro.
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
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const initial = parseIsoDate(value);
  const [month, setMonthState] = useState(initial ? String(initial.month + 1).padStart(2, '0') : '');
  const [day, setDayState] = useState(initial ? String(initial.day).padStart(2, '0') : '');
  const [year, setYearState] = useState(initial ? String(initial.year) : '');

  // Sincroniza cuando `value` cambia desde afuera (se eligió un día en el
  // calendario, o el formulario se reinició) sin pisar lo que se está
  // escribiendo cuando el cambio viene de aquí mismo.
  useEffect(() => {
    const parsed = parseIsoDate(value);
    if (parsed) {
      setMonthState(String(parsed.month + 1).padStart(2, '0'));
      setDayState(String(parsed.day).padStart(2, '0'));
      setYearState(String(parsed.year));
    } else if (value === '') {
      setMonthState('');
      setDayState('');
      setYearState('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(m: string, d: string, y: string) {
    if (m.length === 2 && d.length === 2 && y.length === 4) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange('');
    }
  }

  function setMonth(digits: string) {
    const next = clampSegment(digits.replace(/\D/g, '').slice(0, 2), 12);
    setMonthState(next);
    emit(next, day, year);
    if (next.length === 2) {
      dayRef.current?.focus();
      dayRef.current?.select();
    }
  }

  function setDay(digits: string) {
    const next = clampSegment(digits.replace(/\D/g, '').slice(0, 2), 31);
    setDayState(next);
    emit(month, next, year);
    if (next.length === 2) {
      yearRef.current?.focus();
      yearRef.current?.select();
    }
  }

  function setYear(digits: string) {
    const next = digits.replace(/\D/g, '').slice(0, 4);
    setYearState(next);
    emit(month, day, next);
  }

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
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setViewMonth(nextMonth);
    setViewYear(nextYear);
  }

  const today = todayIso();

  const segmentInputClass = 'bg-transparent text-center tabular-nums outline-none placeholder:text-muted';

  return (
    <div ref={wrapperRef} className="relative w-fit">
      <div
        className={`${className ?? fieldClass} flex w-fit items-center gap-0.5 pr-7 focus-within:outline-none focus-within:ring-2 focus-within:ring-pine`}
      >
        <input
          ref={monthRef}
          id={id}
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' && monthRef.current?.selectionStart === month.length) {
              dayRef.current?.focus();
            }
          }}
          placeholder="mm"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Mes"
          required={required}
          maxLength={2}
          className={`${segmentInputClass} w-7`}
        />
        <span className="text-muted">/</span>
        <input
          ref={dayRef}
          value={day}
          onChange={(event) => setDay(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && day === '') {
              // Sin esto, el navegador borra en el campo al que se acaba de
              // saltar el foco — el backspace "sobra" un campo.
              event.preventDefault();
              monthRef.current?.focus();
              monthRef.current?.select();
            } else if (event.key === 'ArrowLeft' && dayRef.current?.selectionStart === 0) {
              monthRef.current?.focus();
            } else if (event.key === 'ArrowRight' && dayRef.current?.selectionStart === day.length) {
              yearRef.current?.focus();
            }
          }}
          placeholder="dd"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Día"
          required={required}
          maxLength={2}
          className={`${segmentInputClass} w-7`}
        />
        <span className="text-muted">/</span>
        <input
          ref={yearRef}
          value={year}
          onChange={(event) => setYear(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && year === '') {
              event.preventDefault();
              dayRef.current?.focus();
              dayRef.current?.select();
            } else if (event.key === 'ArrowLeft' && yearRef.current?.selectionStart === 0) {
              dayRef.current?.focus();
            }
          }}
          placeholder="yyyy"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Año"
          required={required}
          maxLength={4}
          className={`${segmentInputClass} w-12`}
        />
      </div>
      {/* El campo entero es nuestro ahora, segmentos incluidos — no queda
          ningún `<input type="date">` nativo cuyo ícono el navegador pueda
          seguir dibujando por su cuenta. */}
      <div className="absolute inset-y-px right-px flex w-6 items-center justify-center rounded-r-lg bg-card">
        <button
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : openCalendar())}
          aria-label="Abrir calendario"
          aria-expanded={isOpen}
          className="text-muted hover:text-pine"
        >
          {/* SVG propio y no el emoji 📅: el emoji trae su franja azul fija,
              sin forma de teñirla del pine de la marca. `currentColor` sí
              hereda el color del botón (gris, pine al pasar el mouse). */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="14" height="13" rx="2" />
            <path d="M3 8h14" />
            <path d="M7 2.5v3M13 2.5v3" />
          </svg>
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
