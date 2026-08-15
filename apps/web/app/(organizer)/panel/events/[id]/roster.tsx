'use client';

import { useState, useTransition } from 'react';
import { eyebrowClass, fieldClass } from '@/lib/ui';
import { moveRegistration, numberCategory, removeRegistration, setBibNumber } from './actions';

export interface RosterEntry {
  registrationId: string;
  athleteFullName: string;
  bibNumber: string | null;
}
export interface RosterCategory {
  id: string;
  name: string;
  entries: RosterEntry[];
}

/**
 * Todas las categorías del evento, tengan inscritos o no.
 *
 * Va aparte de `RosterCategory` porque el listado se agrupa por las que sí
 * tienen gente, y a la que uno mueve a alguien es justo la que está vacía: el
 * caso típico es que se inscribió en Intermedio cuando iba a Avanzado, y en
 * Avanzado todavía no hay nadie.
 */
export interface CategoryOption {
  id: string;
  name: string;
}

/** Desde dónde empieza a numerar una categoría que no tiene ningún dorsal. */
const DEFAULT_START = 101;

// Una fila por inscrito, y el dorsal es el único campo editable. Se guarda al
// salir del campo y no con un botón: son veinte filas y un botón por fila es
// veinte clics de más para algo que el organizador hace de corrido, mirando una
// lista en papel.
function Row({
  eventId,
  entry,
  categoryId,
  categories,
}: {
  eventId: string;
  entry: RosterEntry;
  categoryId: string;
  categories: CategoryOption[];
}) {
  const [value, setValue] = useState(entry.bibNumber ?? '');
  const [saved, setSaved] = useState<string | null>(entry.bibNumber ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function move(next: string) {
    if (next === categoryId) {
      return;
    }
    startTransition(async () => {
      const result = await moveRegistration({
        eventId,
        registrationId: entry.registrationId,
        categoryId: next,
      });
      setError(result.ok ? null : result.error);
    });
  }

  // Dos pasos y no un `confirm()`: quitar a alguien no lo puede deshacer el
  // organizador —no hay forma de inscribir a mano, la persona tendría que
  // volver a entrar por el enlace— y un diálogo del navegador bloquea la
  // pestaña entera para preguntar algo que cabe en el propio botón.
  function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const result = await removeRegistration({ eventId, registrationId: entry.registrationId });
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  function commit() {
    const next = value.trim();
    if (next === saved) {
      return;
    }
    startTransition(async () => {
      const result = await setBibNumber({
        eventId,
        registrationId: entry.registrationId,
        bibNumber: next,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSaved(next);
    });
  }

  return (
    // `flex-wrap` con un mínimo para el nombre: en un teléfono el dorsal, el
    // nombre, el desplegable de categoría y "Quitar" suman más ancho del que
    // hay, y sin esto el nombre se recortaba a dos letras. Partido en dos
    // renglones cabe todo. De `sm` para arriba sobra ancho y nunca parte.
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-cardborder/60 py-2 last:border-b-0">
      <input
        aria-label={`Dorsal de ${entry.athleteFullName}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        placeholder="—"
        maxLength={12}
        // Sin `type="number"`: el dorsal es texto ("A-12" existe) y en es-CO un
        // campo numérico además se come el separador decimal sin avisar.
        inputMode="numeric"
        className={`${fieldClass} w-20 shrink-0 text-center font-display font-bold`}
      />
      <span className="min-w-32 flex-1">
        <span className="block truncate text-sm font-medium">{entry.athleteFullName}</span>
        {error && (
          <span role="alert" className="block text-xs font-medium text-red-700">
            {error}
          </span>
        )}
      </span>
      {isPending && <span className="shrink-0 text-xs text-muted">Guardando…</span>}

      {/* Solo se ofrece mover si hay a dónde: con una sola categoría el
          desplegable no tendría más opción que la actual. */}
      {categories.length > 1 && (
        <select
          aria-label={`Categoría de ${entry.athleteFullName}`}
          value={categoryId}
          disabled={isPending}
          onChange={(event) => move(event.target.value)}
          className={`${fieldClass} shrink-0 max-w-40 px-2 py-1.5 text-xs`}
        >
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={remove}
        onBlur={() => setConfirming(false)}
        disabled={isPending}
        className={`shrink-0 text-xs font-medium underline decoration-dotted underline-offset-4 ${
          confirming ? 'text-red-700' : 'text-muted hover:text-bark'
        }`}
      >
        {confirming ? '¿Seguro?' : 'Quitar'}
      </button>
    </li>
  );
}

export function Roster({
  eventId,
  categories,
  allCategories,
}: {
  eventId: string;
  categories: RosterCategory[];
  allCategories: CategoryOption[];
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const total = categories.reduce((sum, c) => sum + c.entries.length, 0);
  const numbered = categories.reduce(
    (sum, c) => sum + c.entries.filter((e) => e.bibNumber !== null).length,
    0,
  );

  if (total === 0) {
    return (
      <p className="rounded-lg border border-cardborder bg-card p-5 text-sm text-muted">
        Todavía no se ha inscrito nadie. Cuando alguien abra el enlace de inscripción y se
        registre, aparece aquí y ya puedes ponerle dorsal.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* La lectura de conjunto va antes que la lista: lo que el organizador
          necesita saber al abrir esto no es quién se inscribió, es si le falta
          numerar a alguien antes de que empiece el evento. */}
      <p className="text-sm text-muted">
        <span className="font-display text-base font-bold text-ink">{total}</span> inscrito
        {total === 1 ? '' : 's'} ·{' '}
        {numbered === total ? (
          <span className="font-semibold text-pine">todos con dorsal</span>
        ) : (
          <span className="font-semibold text-bark">
            {total - numbered} sin dorsal
          </span>
        )}
      </p>

      <ul className="flex flex-col gap-3">
        {categories.map((category) => {
          const isOpen = open[category.id] ?? false;
          const pending = category.entries.filter((e) => e.bibNumber === null).length;
          // Empieza donde el organizador ya venía numerando, para que la segunda
          // categoría no vuelva a arrancar en 101 encima de la primera.
          const highest = Math.max(
            0,
            ...categories
              .flatMap((c) => c.entries)
              .map((e) => Number(e.bibNumber))
              .filter((n) => Number.isFinite(n)),
          );
          const start = highest > 0 ? highest + 1 : DEFAULT_START;

          return (
            <li key={category.id} className="overflow-hidden rounded-lg border border-cardborder bg-card">
              <button
                type="button"
                onClick={() => setOpen((prev) => ({ ...prev, [category.id]: !prev[category.id] }))}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full bg-pine" />
                <span className="min-w-0 flex-1">
                  <span className={`${eyebrowClass} block`}>Categoría</span>
                  <span className="block truncate font-display font-bold">{category.name}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted">
                  {category.entries.length} inscrito{category.entries.length === 1 ? '' : 's'}
                  {pending > 0 && (
                    <>
                      <br />
                      <span className="font-semibold text-bark">{pending} sin dorsal</span>
                    </>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={`shrink-0 font-display text-xl text-pine transition-transform ${
                    isOpen ? 'rotate-45' : ''
                  }`}
                >
                  +
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-cardborder bg-stone/40 px-4 py-3">
                  <ul className="flex flex-col">
                    {/* El dorsal va en la `key` a propósito. El campo guarda su
                        propio estado mientras se escribe, y "Numerar desde"
                        cambia el dato en el servidor por debajo: sin esto la
                        cifra de arriba decía "todos con dorsal" y las casillas
                        seguían vacías hasta recargar. Cambiar la key remonta el
                        campo con el valor nuevo, y solo cuando de verdad
                        cambió. */}
                    {category.entries.map((entry) => (
                      <Row
                        key={`${entry.registrationId}:${entry.bibNumber ?? ''}`}
                        eventId={eventId}
                        entry={entry}
                        categoryId={category.id}
                        categories={allCategories}
                      />
                    ))}
                  </ul>

                  {pending > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-cardborder pt-3">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await numberCategory({ eventId, categoryId: category.id, start });
                          })
                        }
                        className="rounded border-[1.5px] border-pine px-3 py-1.5 text-xs font-semibold text-pine transition hover:bg-pine hover:text-white disabled:opacity-50"
                      >
                        {isPending ? 'Numerando…' : `Numerar desde ${start}`}
                      </button>
                      <span className="text-xs text-muted">
                        Solo llena los que están vacíos, en orden de inscripción. Lo que ya
                        escribiste a mano no se toca.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
