'use client';

import { useState } from 'react';
import { cardClass } from '@/lib/ui';
import { CategoryForm } from './category-form';
import { RoundForm } from './round-form';
import { ProblemForm } from './problem-form';

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
  const parts = [category.gender, category.level].filter(Boolean);
  if (category.minAge || category.maxAge) {
    parts.push(`${category.minAge ?? '?'}-${category.maxAge ?? '?'} años`);
  }
  return parts.length ? parts.join(' · ') : 'Sin restricciones';
}

export function EventStructure({
  eventId,
  categories,
  isOwner,
}: {
  eventId: string;
  categories: Category[];
  isOwner: boolean;
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

      <ul className="flex flex-col gap-3">
        {categories.map((category) => (
          <li key={category.id} className={cardClass}>
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-display text-base font-semibold">
                {category.name}{' '}
                <span className="font-body text-sm font-normal text-muted">
                  ({categorySummary(category)})
                </span>
              </span>
              <span className="text-lg text-bark">{openCategories[category.id] ? '−' : '+'}</span>
            </button>

            {openCategories[category.id] && (
              <div className="mt-4 flex flex-col gap-3 border-l-2 border-sage pl-4">
                {isOwner && <RoundForm eventId={eventId} categoryId={category.id} />}
                <ul className="flex flex-col gap-2">
                  {category.rounds.map((round) => (
                    <li key={round.id} className="rounded-lg border border-cardborder bg-stone p-3">
                      <button
                        type="button"
                        onClick={() => toggleRound(round.id)}
                        className="flex w-full items-center justify-between text-left text-sm font-medium"
                      >
                        <span>{round.type}</span>
                        <span className="text-bark">{openRounds[round.id] ? '−' : '+'}</span>
                      </button>

                      {openRounds[round.id] && (
                        <div className="mt-3 flex flex-col gap-2 border-l-2 border-sage pl-4">
                          {isOwner && <ProblemForm eventId={eventId} roundId={round.id} nextNumber={round.problems.length + 1} />}
                          <ul className="text-sm">
                            {round.problems.map((problem) => (
                              <li key={problem.id}>
                                #{problem.number} {problem.name ?? ''}
                              </li>
                            ))}
                          </ul>
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
