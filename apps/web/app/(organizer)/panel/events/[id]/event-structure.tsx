'use client';

import { useState } from 'react';
import { cardClass } from '@/lib/ui';
import { GENDER_LABEL, ROUND_TYPE_LABEL, labelFor } from '@/lib/labels';
import { CategoryForm } from './category-form';
import { RoundForm } from './round-form';
import { ProblemForm } from './problem-form';
import { ProblemQr } from './problem-qr';

type Problem = { id: string; number: number; name: string | null };
type Round = { id: string; type: string; order: number; problems: Problem[] };
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

function problemCount(category: Category): string {
  const total = category.rounds.reduce((sum, round) => sum + round.problems.length, 0);
  if (category.rounds.length === 0) {
    return 'Sin rondas todavía';
  }
  const rondas = category.rounds.length === 1 ? '1 ronda' : `${category.rounds.length} rondas`;
  const bloques = total === 1 ? '1 bloque' : `${total} bloques`;
  return `${rondas} · ${bloques}`;
}

export function EventStructure({
  eventId,
  categories,
  isOwner,
  scoringFormat,
  slug,
}: {
  eventId: string;
  categories: Category[];
  isOwner: boolean;
  scoringFormat: string;
  slug: string;
}) {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openRounds, setOpenRounds] = useState<Record<string, boolean>>({});

  function toggleCategory(id: string) {
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function toggleRound(id: string) {
    setOpenRounds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      {isOwner && <CategoryForm eventId={eventId} />}

      {categories.length === 0 && (
        <p className={`${cardClass} text-sm text-muted`}>
          Todavía no hay categorías. Crea la primera arriba — sin categorías nadie puede
          inscribirse, porque al inscribirse cada persona elige la suya.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {categories.map((category) => (
          <li key={category.id} className={cardClass}>
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold">{category.name}</span>
                <span className="block text-sm text-muted">
                  {categorySummary(category)} · {problemCount(category)}
                </span>
              </span>
              <span className="shrink-0 text-lg text-bark" aria-hidden="true">
                {openCategories[category.id] ? '−' : '+'}
              </span>
            </button>

            {openCategories[category.id] && (
              <div className="mt-4 flex flex-col gap-3 border-l-2 border-sage pl-4">
                {isOwner && <RoundForm eventId={eventId} categoryId={category.id} />}
                {category.rounds.length === 0 && (
                  <p className="text-sm text-muted">
                    Sin rondas. Agrega al menos la clasificatoria para poder crear bloques.
                  </p>
                )}
                <ul className="flex flex-col gap-2">
                  {category.rounds.map((round) => (
                    <li key={round.id} className="rounded-lg border border-cardborder bg-stone p-3">
                      <button
                        type="button"
                        onClick={() => toggleRound(round.id)}
                        className="flex w-full items-center justify-between text-left text-sm font-medium"
                      >
                        <span>
                          {labelFor(ROUND_TYPE_LABEL, round.type)}
                          <span className="ml-2 font-normal text-muted">
                            {round.problems.length === 1
                              ? '1 bloque'
                              : `${round.problems.length} bloques`}
                          </span>
                        </span>
                        <span className="text-bark">{openRounds[round.id] ? '−' : '+'}</span>
                      </button>

                      {openRounds[round.id] && (
                        <div className="mt-3 flex flex-col gap-2 border-l-2 border-sage pl-4">
                          {isOwner && (
                            <ProblemForm
                              eventId={eventId}
                              roundId={round.id}
                              nextNumber={round.problems.length + 1}
                              scoringFormat={scoringFormat}
                            />
                          )}
                          {round.problems.length === 0 ? (
                            <p className="text-sm text-muted">
                              Sin bloques todavía. Cada bloque que agregues genera su propio QR
                              para que el juez entre directo a puntuarlo.
                            </p>
                          ) : (
                            <ul className="flex flex-col gap-2 text-sm">
                              {round.problems.map((problem) => (
                                <li
                                  key={problem.id}
                                  className="flex items-start justify-between gap-2"
                                >
                                  <span className="font-medium">
                                    Bloque {problem.number}
                                    {problem.name ? ` · ${problem.name}` : ''}
                                  </span>
                                  <ProblemQr slug={slug} problemId={problem.id} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
