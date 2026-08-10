'use client';

import { useState } from 'react';
import { fieldClass } from '@/lib/ui';
import type { JudgeRegistration } from './capture-app';

export type RosterEntry = {
  registration: JudgeRegistration;
  /** What the wall says right now: null when nobody has scored this athlete on this block. */
  result: string | null;
  isPending: boolean;
  judgedBy: string | null;
};

function matches(entry: RosterEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return (
    (entry.registration.bibNumber ?? '').toLowerCase().includes(needle) ||
    entry.registration.athleteFullName.toLowerCase().includes(needle)
  );
}

export function AthleteRoster({
  entries,
  selectedId,
  onSelect,
}: {
  entries: RosterEntry[];
  selectedId: string | null;
  onSelect: (registrationId: string) => void;
}) {
  const [query, setQuery] = useState('');

  const visible = entries.filter((entry) => matches(entry, query));
  const judged = entries.filter((entry) => entry.result !== null).length;

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-cardborder bg-white px-4 py-6 text-center text-sm text-muted">
        Todavía no hay nadie inscrito en esta categoría. En cuanto se inscriban aparecerán aquí.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-bark">Competidores de este bloque</span>
        <span className="text-xs text-muted">
          {judged} de {entries.length} juzgados
        </span>
      </div>

      {entries.length > 6 && (
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar por dorsal o nombre"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${fieldClass} py-2 text-base`}
        />
      )}

      <ul className="flex flex-col gap-1.5">
        {visible.map((entry) => {
          const isSelected = entry.registration.id === selectedId;
          const isJudged = entry.result !== null;
          return (
            <li key={entry.registration.id}>
              <button
                type="button"
                onClick={() => onSelect(entry.registration.id)}
                aria-pressed={isSelected}
                className={`flex min-h-14 w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left transition ${
                  isSelected ? 'border-gold bg-white' : 'border-cardborder bg-white hover:border-sage'
                }`}
              >
                <span
                  className={`flex h-10 w-12 shrink-0 items-center justify-center rounded font-display text-lg font-bold tabular-nums ${
                    isJudged ? 'bg-pine text-stone' : 'bg-stone text-muted'
                  }`}
                >
                  {entry.registration.bibNumber ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-semibold text-ink">
                    {entry.registration.athleteFullName}
                  </span>
                  <span className={`block truncate text-xs ${isJudged ? 'text-pine' : 'text-muted'}`}>
                    {entry.result ?? 'Sin juzgar'}
                    {entry.isPending && ' · por enviar'}
                    {entry.judgedBy && !entry.isPending && ` · ${entry.judgedBy}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="px-1 py-2 text-sm text-muted">
          Nadie coincide con “{query}”. Revisa el dorsal o busca por nombre.
        </p>
      )}
    </div>
  );
}
