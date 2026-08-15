'use client';

import { useState, useTransition } from 'react';
import { cardClass, eyebrowClass } from '@/lib/ui';
import { GENDER_LABEL, ROUND_TYPE_LABEL, labelFor, problemUnit } from '@/lib/labels';
import { removeCategory, removeRound } from './actions';
import { CategoryForm } from './category-form';
import { RoundForm } from './round-form';
import { RoundAdvances } from './round-advances';
import { ProblemForm } from './problem-form';
import { ProblemCard } from './problem-qr';

type Problem = {
  id: string;
  number: number;
  name: string | null;
  topPoints: number | null;
  zonePoints: number | null;
};
type Round = {
  id: string;
  type: string;
  order: number;
  advances: number | null;
  problems: Problem[];
};
type Category = {
  id: string;
  name: string;
  gender: string | null;
  minAge: number | null;
  maxAge: number | null;
  level: string | null;
  rounds: Round[];
};

function categorySummary(category: Category): string {
  const parts: string[] = [];
  if (category.gender) {
    parts.push(labelFor(GENDER_LABEL, category.gender));
  }
  if (category.level) {
    parts.push(category.level);
  }
  if (category.minAge && category.maxAge) {
    parts.push(`${category.minAge} a ${category.maxAge} años`);
  } else if (category.minAge) {
    parts.push(`desde ${category.minAge} años`);
  } else if (category.maxAge) {
    parts.push(`hasta ${category.maxAge} años`);
  }
  return parts.length ? parts.join(' · ') : 'Abierta a todos';
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Un nodo sobre la línea que baja por la estructura. La jerarquía del evento es
// una cadena — categoría lleva a ronda, ronda lleva a bloque — y dibujarla como
// tres cajas blancas idénticas era justo lo que la volvía ilegible.
function SpineNode({ tone }: { tone: 'round' | 'problem' }) {
  const color = tone === 'round' ? 'border-bark bg-stone' : 'border-gold bg-gold';
  return (
    <span
      aria-hidden="true"
      className={`absolute -left-[7px] top-3 h-3 w-3 rounded-full border-2 ${color}`}
    />
  );
}

// Dos pasos y no un `confirm()`, igual que quitar a un inscrito: el diálogo del
// navegador bloquea la pestaña para preguntar algo que cabe en el propio botón.
// Va dentro del nivel abierto y no en su encabezado, que ya es un <button>.
function RemoveNode({
  label,
  takesWith,
  remove,
}: {
  label: string;
  /** Qué más se lleva por delante. Se dice al confirmar, no antes. */
  takesWith: string | null;
  remove: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function click() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const result = await remove();
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
      {error && (
        <span role="alert" className="flex-1 text-xs font-medium text-red-700">
          {error}
        </span>
      )}
      {/* Qué se lleva por delante, junto al botón: una confirmación que no dice
          qué más desaparece no está confirmando nada. */}
      {confirming && takesWith && <span className="text-xs text-muted">{takesWith}</span>}
      <button
        type="button"
        onClick={click}
        onBlur={() => setConfirming(false)}
        disabled={isPending}
        className={`text-xs font-medium underline decoration-dotted underline-offset-4 ${
          confirming ? 'text-red-700' : 'text-muted hover:text-bark'
        }`}
      >
        {isPending ? 'Borrando…' : confirming ? '¿Seguro?' : label}
      </button>
    </div>
  );
}

function countPhrase(count: number, singular: string, plural: string): string {
  return count === 1 ? `su ${singular}` : `sus ${count} ${plural}`;
}

export function EventStructure({
  eventId,
  categories,
  discipline,
  scoringFormat,
  slug,
}: {
  eventId: string;
  categories: Category[];
  discipline: string;
  scoringFormat: string;
  slug: string;
}) {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openRounds, setOpenRounds] = useState<Record<string, boolean>>({});
  const unit = problemUnit(discipline);

  function toggleCategory(id: string) {
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function toggleRound(id: string) {
    setOpenRounds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      {categories.length === 0 && (
        <p className={`${cardClass} text-sm text-muted`}>
          Todavía no hay categorías. Crea la primera abajo — sin categorías nadie puede inscribirse,
          porque al inscribirse cada persona elige la suya.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {categories.map((category) => {
          const isOpen = openCategories[category.id] ?? false;
          const totalProblems = category.rounds.reduce(
            (sum, round) => sum + round.problems.length,
            0,
          );

          return (
            <li
              key={category.id}
              className={`overflow-hidden rounded-lg border bg-card transition ${
                isOpen ? 'border-pine' : 'border-cardborder'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-5 text-left"
              >
                {/* La barra de color es el ancla del nivel: donde empieza la
                    categoría, y de dónde cuelga todo lo que va dentro. */}
                <span aria-hidden="true" className="h-10 w-1 shrink-0 rounded-full bg-pine" />
                <span className="min-w-0 flex-1">
                  <span className={`${eyebrowClass} block`}>Categoría</span>
                  <span className="block truncate font-display text-lg font-bold">
                    {category.name}
                  </span>
                  <span className="block text-sm text-muted">{categorySummary(category)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-right text-xs text-muted sm:block">
                    {category.rounds.length === 0 ? (
                      'Sin rondas'
                    ) : (
                      <>
                        {countLabel(category.rounds.length, 'ronda', 'rondas')}
                        <br />
                        {countLabel(totalProblems, unit.singular, unit.plural)}
                      </>
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`font-display text-xl text-pine transition-transform ${
                      isOpen ? 'rotate-45' : ''
                    }`}
                  >
                    +
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-cardborder bg-stone/40 px-5 py-4">
                  <div className="relative flex flex-col gap-3 border-l-2 border-sage pl-5">
                    {category.rounds.length === 0 && (
                      <p className="text-sm text-muted">
                        Esta categoría no tiene rondas. Agrega al menos la clasificatoria: los{' '}
                        {unit.plural} viven dentro de una ronda.
                      </p>
                    )}

                    {category.rounds.map((round) => {
                      const roundIsOpen = openRounds[round.id] ?? false;
                      return (
                        <div key={round.id} className="relative">
                          <SpineNode tone="round" />
                          <button
                            type="button"
                            onClick={() => toggleRound(round.id)}
                            aria-expanded={roundIsOpen}
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-cardborder bg-card px-4 py-3 text-left"
                          >
                            <span>
                              <span className={`${eyebrowClass} block`}>Ronda</span>
                              <span className="font-display font-semibold">
                                {labelFor(ROUND_TYPE_LABEL, round.type)}
                              </span>
                            </span>
                            <span className="flex items-center gap-3 text-sm text-muted">
                              {countLabel(round.problems.length, unit.singular, unit.plural)}
                              <span
                                aria-hidden="true"
                                className={`font-display text-lg text-bark transition-transform ${
                                  roundIsOpen ? 'rotate-45' : ''
                                }`}
                              >
                                +
                              </span>
                            </span>
                          </button>

                          {roundIsOpen && (
                            <div className="relative mt-3 flex flex-col gap-2 border-l-2 border-sage pl-5">
                              {/* Solo si hay una ronda después: de la última no
                                  pasa nadie a ningún lado. */}
                              {round.order < category.rounds.length && (
                                <div className="mb-2 rounded-lg border border-cardborder bg-stone/50 p-3">
                                  <RoundAdvances
                                    eventId={eventId}
                                    roundId={round.id}
                                    advances={round.advances}
                                  />
                                </div>
                              )}

                              {round.problems.length === 0 && (
                                <p className="text-sm text-muted">
                                  Sin {unit.plural}. Cada {unit.singular} que agregues genera su
                                  propio QR para que el juez entre directo a puntuarlo.
                                </p>
                              )}

                              {round.problems.map((problem) => (
                                <div key={problem.id} className="relative">
                                  <SpineNode tone="problem" />
                                  <ProblemCard
                                    slug={slug}
                                    eventId={eventId}
                                    problemId={problem.id}
                                    number={problem.number}
                                    name={problem.name}
                                    topPoints={problem.topPoints}
                                    zonePoints={problem.zonePoints}
                                    isLeaguePoints={scoringFormat === 'league_points'}
                                    unit={unit}
                                  />
                                </div>
                              ))}

                              <ProblemForm
                                eventId={eventId}
                                roundId={round.id}
                                nextNumber={round.problems.length + 1}
                                scoringFormat={scoringFormat}
                                unit={unit}
                              />

                              <RemoveNode
                                label="Borrar ronda"
                                takesWith={
                                  round.problems.length > 0
                                    ? `Se borran también ${countPhrase(round.problems.length, unit.singular, unit.plural)}.`
                                    : null
                                }
                                remove={() => removeRound({ eventId, roundId: round.id })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <RoundForm eventId={eventId} categoryId={category.id} />

                    <RemoveNode
                      label="Borrar categoría"
                      takesWith={
                        category.rounds.length > 0
                          ? `Se borran también ${countPhrase(category.rounds.length, 'ronda', 'rondas')}${
                              totalProblems > 0
                                ? ` y ${countPhrase(totalProblems, unit.singular, unit.plural)}`
                                : ''
                            }.`
                          : null
                      }
                      remove={() => removeCategory({ eventId, categoryId: category.id })}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <CategoryForm eventId={eventId} />
    </div>
  );
}
